// SPDX-License-Identifier: AGPL-3.0-only

import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Db } from '@tessio/db';
import { reportsRepo, runReport } from '@tessio/db';
import { reportDefinition, type ReportDefinition } from '@tessio/shared';
import { ApiError } from '../errors';

const idParam = z.object({ id: z.string().uuid() });

const reportSummary = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  visualization: z.enum(['number', 'table', 'bar', 'line', 'pie']),
  updatedAt: z.string(),
});

const reportFull = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  definition: reportDefinition,
  updatedAt: z.string(),
});

const createBody = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  definition: reportDefinition,
});

const patchBody = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  definition: reportDefinition.optional(),
});

const runBody = z.object({
  definition: reportDefinition,
});

const runResponse = z.object({
  rows: z.array(z.object({ key: z.string().nullable(), value: z.number() })),
});

function presentFull(row: { id: string; name: string; description: string | null | undefined; definition: ReportDefinition; updatedAt: Date }) {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    definition: row.definition,
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function safeRunReport(
  db: Db,
  orgId: string,
  def: Parameters<typeof runReport>[2],
  scope: Parameters<typeof runReport>[3],
) {
  try {
    return await runReport(db, orgId, def, scope);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/^Unknown (measure|dimension)/.test(msg)) {
      throw new ApiError(400, 'Invalid Report', msg);
    }
    throw err;
  }
}

/** Staff-only (agent/admin) reports resource. */
export function registerReportRoutes(app: FastifyInstance, db: Db): void {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const repo = reportsRepo(db);

  // GET /reports → summary list
  r.get('/reports', { schema: { response: { 200: z.array(reportSummary) } } }, async (req) => {
    const rows = await repo.list(req.orgId);
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description ?? null,
      visualization: row.definition.visualization,
      updatedAt: row.updatedAt.toISOString(),
    }));
  });

  // POST /reports → 201 full report
  r.post('/reports', { schema: { body: createBody, response: { 201: reportFull } } }, async (req, reply) => {
    const { name, description, definition } = req.body;
    const row = await repo.create({
      orgId: req.orgId,
      name,
      description: description ?? null,
      definition,
      ownerId: req.user.id,
    });
    reply.code(201);
    return presentFull(row);
  });

  // POST /reports/run → run an unsaved definition
  r.post('/reports/run', { schema: { body: runBody, response: { 200: runResponse } } }, async (req) => {
    return safeRunReport(db, req.orgId, req.body.definition, {
      userId: req.user.id,
      role: req.user.role,
    });
  });

  // GET /reports/:id → full report
  r.get('/reports/:id', { schema: { params: idParam, response: { 200: reportFull } } }, async (req) => {
    const row = await repo.get(req.orgId, req.params.id);
    if (!row) throw new ApiError(404, 'Not Found', `No report with id "${req.params.id}".`);
    return presentFull(row);
  });

  // PATCH /reports/:id → updated full report
  r.patch('/reports/:id', { schema: { params: idParam, body: patchBody, response: { 200: reportFull } } }, async (req) => {
    const row = await repo.update(req.orgId, req.params.id, req.body);
    if (!row) throw new ApiError(404, 'Not Found', `No report with id "${req.params.id}".`);
    return presentFull(row);
  });

  // DELETE /reports/:id → 204
  r.delete('/reports/:id', { schema: { params: idParam, response: { 204: z.null() } } }, async (req, reply) => {
    const existing = await repo.get(req.orgId, req.params.id);
    if (!existing) throw new ApiError(404, 'Not Found', `No report with id "${req.params.id}".`);
    await repo.remove(req.orgId, req.params.id);
    reply.code(204);
    return null;
  });

  // GET /reports/:id/run → run a saved report
  r.get('/reports/:id/run', { schema: { params: idParam, response: { 200: runResponse } } }, async (req) => {
    const row = await repo.get(req.orgId, req.params.id);
    if (!row) throw new ApiError(404, 'Not Found', `No report with id "${req.params.id}".`);
    return safeRunReport(db, req.orgId, row.definition, {
      userId: req.user.id,
      role: req.user.role,
    });
  });
}
