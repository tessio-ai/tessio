// SPDX-License-Identifier: AGPL-3.0-only

import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Db, RecordKind } from '@tessio/db';
import { linksRepo } from '@tessio/db';
import { recordResponse } from './schemas';

const recordKindSchema = z.enum(['ticket', 'asset', 'kb_article', 'form_submission']);
const parentParam = z.object({ id: z.string().uuid() });
const linkBody = z.object({
  toType: recordKindSchema,
  toId: z.string().uuid(),
  relationshipType: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
});
const traverseQuery = z.object({
  relationshipType: z.string().min(1),
  maxDepth: z.coerce.number().int().positive().max(20).default(5),
});
const reachableResponse = z.object({ toType: z.string(), toId: z.string(), depth: z.number() });

/** Register link routes for one record kind at a URL segment. */
export function registerLinkRoutes(
  app: FastifyInstance,
  db: Db,
  segment: string,
  kind: RecordKind,
): void {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.post(
    `/${segment}/:id/links`,
    { schema: { params: parentParam, body: linkBody, response: { 201: recordResponse } } },
    async (req, reply) => {
      const { id } = req.params as z.infer<typeof parentParam>;
      const b = req.body as z.infer<typeof linkBody>;
      const created = await linksRepo(db).createLink(req.orgId, {
        fromType: kind,
        fromId: id,
        toType: b.toType,
        toId: b.toId,
        relationshipType: b.relationshipType,
        metadata: b.metadata,
      });
      reply.code(201);
      return created;
    },
  );

  r.get(
    `/${segment}/:id/links`,
    { schema: { params: parentParam, response: { 200: z.array(recordResponse) } } },
    async (req) => {
      const { id } = req.params as z.infer<typeof parentParam>;
      return linksRepo(db).listLinks(req.orgId, kind, id);
    },
  );

  r.delete(
    `/${segment}/:id/links/:linkId`,
    { schema: { params: parentParam.extend({ linkId: z.string().uuid() }), response: { 204: z.undefined() } } },
    async (req, reply) => {
      const { linkId } = req.params as { id: string; linkId: string };
      await linksRepo(db).deleteLink(req.orgId, linkId);
      reply.code(204);
    },
  );

  r.get(
    `/${segment}/:id/links/traverse`,
    { schema: { params: parentParam, querystring: traverseQuery, response: { 200: z.array(reachableResponse) } } },
    async (req) => {
      const { id } = req.params as z.infer<typeof parentParam>;
      const q = req.query as z.infer<typeof traverseQuery>;
      return linksRepo(db).traverse(req.orgId, kind, id, q.relationshipType, q.maxDepth);
    },
  );
}
