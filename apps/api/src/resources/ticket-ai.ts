// SPDX-License-Identifier: AGPL-3.0-only

import type { FastifyInstance, FastifyReply } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Db } from '@tessio/db';
import { ticketsRepo, usersRepo, listComments, ticketAiTriageRepo, recordActivity, ticketEmbeddingsRepo } from '@tessio/db';
import {
  createTessClient,
  streamTicketSummary,
  streamDraftReply,
  triageTicket,
  type AiSettings,
  type TicketContext,
  type CommentContext,
} from '@tessio/ai';
import { resolveAiSettings } from '../ai/resolve';
import { notFound, conflict } from '../errors';
import { idParam } from './schemas';

function assertFeature(settings: AiSettings, feature: 'summary' | 'draft' | 'triage' | 'similar'): void {
  if (!settings.enabled) throw conflict('Tess AI is not enabled for this org');
  if (!settings.features[feature]) throw conflict(`Tess ${feature} is not enabled`);
  const modelToCheck = feature === 'similar' ? settings.embeddingModel : settings.model;
  if (!modelToCheck) throw conflict('Tess AI has no model configured');
}

type TeamScope = { userId: string; role: string };

async function loadTicketContext(db: Db, orgId: string, ticketId: string, scope?: TeamScope): Promise<TicketContext> {
  const ticket = await ticketsRepo(db).getById(orgId, ticketId, scope);
  if (!ticket) throw notFound(`ticket ${ticketId} not found`);
  const data = (ticket.data ?? {}) as Record<string, unknown>;
  return {
    number: ticket.number as number,
    title: (data.title as string) ?? '',
    description: (data.description as string) ?? '',
    category: (data.category as string) ?? null,
  };
}

async function loadComments(db: Db, orgId: string, ticketId: string): Promise<CommentContext[]> {
  const rows = await listComments(db, orgId, 'ticket', ticketId);
  return rows.map((c) => ({ author: c.authorId ?? 'unknown', internal: !!c.internal, body: c.body }));
}

async function streamToReply(reply: FastifyReply, textStream: AsyncIterable<string>): Promise<void> {
  reply.hijack();
  reply.raw.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
  try {
    for await (const delta of textStream) reply.raw.write(delta);
  } catch (err) {
    reply.raw.write(`\n[error: ${(err as Error).message}]`);
  } finally {
    reply.raw.end();
  }
}

const similarResponse = z.array(
  z.object({
    id: z.string(),
    number: z.number().nullable(),
    title: z.string().nullable(),
    status: z.string().nullable(),
    assigneeId: z.string().nullable(),
    score: z.number(),
  }),
);

const triageResponse = z.object({
  ticketId: z.string(),
  category: z.string().nullable(),
  priority: z.string().nullable(),
  suggestedAssigneeId: z.string().nullable(),
  confidence: z.number().nullable(),
  reasoning: z.string().nullable(),
  triagedAt: z.string().nullable(),
});

/** Ticket-scoped Tess AI endpoints. Guard with agent/admin roles at registration. */
export function registerTicketAiRoutes(app: FastifyInstance, db: Db): void {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.post('/tickets/:id/ai/summary', { schema: { params: idParam } }, async (req, reply) => {
    const { id } = req.params as z.infer<typeof idParam>;
    const settings = await resolveAiSettings(db, req.orgId);
    assertFeature(settings, 'summary');
    const scope = { userId: req.user.id, role: req.user.role };
    const ticket = await loadTicketContext(db, req.orgId, id, scope);
    const comments = await loadComments(db, req.orgId, id);
    const result = streamTicketSummary({ model: createTessClient(settings), ticket, comments, botName: settings.botName });
    await streamToReply(reply, result.textStream);
  });

  r.post('/tickets/:id/ai/draft', { schema: { params: idParam } }, async (req, reply) => {
    const { id } = req.params as z.infer<typeof idParam>;
    const settings = await resolveAiSettings(db, req.orgId);
    assertFeature(settings, 'draft');
    const scope = { userId: req.user.id, role: req.user.role };
    const ticket = await loadTicketContext(db, req.orgId, id, scope);
    const comments = await loadComments(db, req.orgId, id);
    const full = await ticketsRepo(db).getById(req.orgId, id, scope);
    const requesterId = full?.requesterId as string | undefined;
    const requester = requesterId ? await usersRepo(db).findById(requesterId) : undefined;
    const result = streamDraftReply({
      model: createTessClient(settings),
      ticket,
      comments,
      requesterName: requester?.name ?? null,
      botName: settings.botName,
    });
    await streamToReply(reply, result.textStream);
  });

  r.post('/tickets/:id/ai/triage', { schema: { params: idParam, response: { 200: triageResponse } } }, async (req) => {
    const { id } = req.params as z.infer<typeof idParam>;
    const settings = await resolveAiSettings(db, req.orgId);
    assertFeature(settings, 'triage');
    const ticket = await loadTicketContext(db, req.orgId, id, { userId: req.user.id, role: req.user.role });
    const candidates = (await usersRepo(db).list(req.orgId))
      .filter((u) => u.role !== 'requester')
      .map((u) => ({ id: u.id, name: u.name }));
    const result = await triageTicket({ model: createTessClient(settings), ticket, candidateAgents: candidates, botName: settings.botName });
    const saved = await ticketAiTriageRepo(db).upsert({
      ticketId: id,
      category: result.category,
      priority: result.priority,
      suggestedAssigneeId: result.suggestedAssigneeId,
      confidence: result.confidence,
      reasoning: result.reasoning,
    });
    await recordActivity(db, { orgId: req.orgId, actorId: req.user.id, recordType: 'ticket', recordId: id, eventType: 'tess.triaged' });
    return {
      ticketId: saved.ticketId,
      category: saved.category,
      priority: saved.priority,
      suggestedAssigneeId: saved.suggestedAssigneeId,
      confidence: saved.confidence,
      reasoning: saved.reasoning,
      triagedAt: saved.triagedAt instanceof Date ? saved.triagedAt.toISOString() : null,
    };
  });

  // Read the stored triage for a ticket (used by the detail view + queue).
  r.get('/tickets/:id/ai/triage', { schema: { params: idParam, response: { 200: triageResponse.nullable() } } }, async (req) => {
    const { id } = req.params as z.infer<typeof idParam>;
    const ticket = await ticketsRepo(db).getById(req.orgId, id, { userId: req.user.id, role: req.user.role });
    if (!ticket) throw notFound(`ticket ${id} not found`);
    const row = await ticketAiTriageRepo(db).get(id);
    if (!row) return null;
    return {
      ticketId: row.ticketId,
      category: row.category,
      priority: row.priority,
      suggestedAssigneeId: row.suggestedAssigneeId,
      confidence: row.confidence,
      reasoning: row.reasoning,
      triagedAt: row.triagedAt instanceof Date ? row.triagedAt.toISOString() : null,
    };
  });

  r.get('/tickets/:id/ai/similar', { schema: { params: idParam, response: { 200: similarResponse } } }, async (req) => {
    const { id } = req.params as z.infer<typeof idParam>;
    const settings = await resolveAiSettings(db, req.orgId);
    assertFeature(settings, 'similar');
    const scope = { userId: req.user.id, role: req.user.role };
    // Team-scope the source ticket so an out-of-team agent can't seed a similarity
    // search from a ticket they can't see (the results are already team-scoped).
    const ticket = await ticketsRepo(db).getById(req.orgId, id, scope);
    if (!ticket) throw notFound(`ticket ${id} not found`);
    return ticketEmbeddingsRepo(db).findSimilar(req.orgId, id, { limit: 5, scope });
  });
}
