// SPDX-License-Identifier: AGPL-3.0-only

import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Db } from '@tessio/db';
import { kbRevisionsRepo, kbArticlesRepo } from '@tessio/db';
import { recordResponse } from './schemas';
import { notFound } from '../errors';

const articleParam = z.object({ id: z.string().uuid() });
const revParam = z.object({ id: z.string().uuid(), revisionId: z.string().uuid() });
const summaryOut = z.object({ id: z.string(), version: z.number(), title: z.string().nullable(), authorId: z.string().nullable(), createdAt: z.coerce.string() });

/** Staff-only KB article revision history (list / view / restore). */
export function registerKbRevisionRoutes(app: FastifyInstance, db: Db): void {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get('/kb-articles/:id/revisions', { schema: { params: articleParam, response: { 200: z.array(summaryOut) } } }, async (req) => {
    const { id } = req.params as z.infer<typeof articleParam>;
    const rows = await kbRevisionsRepo(db).list(req.orgId, id);
    return rows.map((r) => ({ ...r, createdAt: String(r.createdAt) }));
  });

  r.get('/kb-articles/:id/revisions/:revisionId', { schema: { params: revParam, response: { 200: recordResponse } } }, async (req) => {
    const { id, revisionId } = req.params as z.infer<typeof revParam>;
    const rev = await kbRevisionsRepo(db).get(req.orgId, id, revisionId);
    if (!rev) throw notFound(`revision ${revisionId} not found`);
    return { id: rev.id, version: rev.version, title: rev.title, data: rev.data, createdAt: String(rev.createdAt) };
  });

  r.post('/kb-articles/:id/revisions/:revisionId/restore', { schema: { params: revParam, response: { 200: recordResponse } } }, async (req) => {
    const { id, revisionId } = req.params as z.infer<typeof revParam>;
    const rev = await kbRevisionsRepo(db).get(req.orgId, id, revisionId);
    if (!rev) throw notFound(`revision ${revisionId} not found`);
    const updated = await kbArticlesRepo(db).update(req.orgId, id, { title: rev.title, data: rev.data } as Record<string, unknown>);
    if (!updated) throw notFound(`kb-articles ${id} not found`);
    await kbRevisionsRepo(db).snapshot(req.orgId, { id, title: rev.title, data: rev.data as Record<string, unknown> }, req.user.id);
    return updated;
  });
}
