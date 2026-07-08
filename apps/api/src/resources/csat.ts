// SPDX-License-Identifier: AGPL-3.0-only

import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Db } from '@tessio/db';
import { csatSettingsRepo, csatResponsesRepo, ticketsRepo } from '@tessio/db';
import { csatSettingsInput, csatSubmitBody, CSAT_TRIGGER_STATUSES } from '@tessio/shared';
import { notFound, badRequest, conflict } from '../errors';
import { recordAudit, safeMeta } from '../audit';

const settingsResponse = z.object({
  enabled: z.boolean(),
  question: z.string().nullable(),
});

const responseView = z.object({
  ticketId: z.string(),
  rating: z.number().nullable(),
  comment: z.string().nullable(),
  sentAt: z.string(),
  respondedAt: z.string().nullable(),
});

type ResponseRow = {
  ticketId: string;
  rating: number | null;
  comment: string | null;
  sentAt: Date;
  respondedAt: Date | null;
};

const present = (r: ResponseRow) => ({
  ticketId: r.ticketId,
  rating: r.rating,
  comment: r.comment,
  sentAt: r.sentAt.toISOString(),
  respondedAt: r.respondedAt ? r.respondedAt.toISOString() : null,
});

const idParam = z.object({ id: z.string().uuid() });

/** Admin-only satisfaction survey settings. Caller must be guarded by requireRole('admin'). */
export function registerCsatSettingsRoutes(app: FastifyInstance, db: Db): void {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const repo = csatSettingsRepo(db);

  r.get('/csat-settings', { schema: { response: { 200: settingsResponse } } }, async (req) => {
    const row = await repo.getOrCreate(req.orgId);
    return { enabled: row!.enabled, question: row!.question };
  });

  r.put('/csat-settings', { schema: { body: csatSettingsInput, response: { 200: settingsResponse } } }, async (req) => {
    await repo.getOrCreate(req.orgId);
    const patch: Record<string, unknown> = { updatedBy: req.user.id };
    if (req.body.enabled !== undefined) patch.enabled = req.body.enabled;
    if (req.body.question !== undefined) patch.question = req.body.question || null;
    const updated = await repo.update(req.orgId, patch);
    void recordAudit(db, { orgId: req.orgId, actorId: req.user.id, actorEmail: req.user.email, action: 'settings.csat.updated', metadata: safeMeta(req.body as Record<string, unknown>, ['enabled']), ip: req.ip });
    return { enabled: updated!.enabled, question: updated!.question };
  });
}

/** Requester-facing survey routes (any authenticated role; ownership-checked). */
export function registerPortalCsatRoutes(app: FastifyInstance, db: Db): void {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const settings = csatSettingsRepo(db);
  const responses = csatResponsesRepo(db);

  // The caller's survey state: whether surveys are on, the question to ask,
  // and their existing responses (keyed by ticket) for the "my requests" view.
  r.get('/portal/csat', {
    schema: { response: { 200: z.object({ enabled: z.boolean(), question: z.string().nullable(), responses: z.array(responseView) }) } },
  }, async (req) => {
    const s = await settings.getOrCreate(req.orgId);
    const mine = await responses.listByRequester(req.orgId, req.user.id);
    return { enabled: s!.enabled, question: s!.question, responses: mine.map(present) };
  });

  r.post('/portal/tickets/:id/csat', {
    schema: { params: idParam, body: csatSubmitBody, response: { 201: responseView } },
  }, async (req, reply) => {
    const { id } = req.params;
    const s = await settings.getOrCreate(req.orgId);
    if (!s!.enabled) throw notFound('satisfaction surveys are not enabled');

    const ticket = await ticketsRepo(db).getById(req.orgId, id);
    // 404 (not 403) when the ticket isn't the caller's — don't leak other tickets' existence.
    if (!ticket || ticket.requesterId !== req.user.id) throw notFound(`ticket ${id} not found`);
    if (typeof ticket.status !== 'string' || !CSAT_TRIGGER_STATUSES.has(ticket.status)) {
      throw badRequest('only resolved or closed tickets can be rated');
    }

    const row = await responses.submit({
      orgId: req.orgId,
      ticketId: id,
      requesterId: req.user.id,
      rating: req.body.rating,
      comment: req.body.comment?.trim() || null,
    });
    if (!row) throw conflict('this ticket has already been rated');
    reply.code(201);
    return present(row);
  });
}

/** Staff read of a ticket's survey result. Caller must be guarded by requireRole('agent','admin'). */
export function registerTicketCsatRoutes(app: FastifyInstance, db: Db): void {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get('/tickets/:id/csat', {
    schema: { params: idParam, response: { 200: z.object({ survey: responseView.nullable() }) } },
  }, async (req) => {
    const ticket = await ticketsRepo(db).getById(req.orgId, req.params.id);
    if (!ticket) throw notFound(`ticket ${req.params.id} not found`);
    const row = await csatResponsesRepo(db).getByTicket(req.orgId, req.params.id);
    return { survey: row ? present(row) : null };
  });
}
