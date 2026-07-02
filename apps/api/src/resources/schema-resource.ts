// SPDX-License-Identifier: AGPL-3.0-only

import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Db } from '@tessio/db';
import { schemasRepo } from '@tessio/db';
import { recordResponse, idParam } from './schemas';
import { notFound } from '../errors';

const listSchemasQuery = z.object({
  kind: z.enum(['ticket', 'asset', 'kb_article', 'form']).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
});

/** Register the read-only /schemas routes (record-type definitions). */
export function registerSchemaRoutes(app: FastifyInstance, db: Db): void {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get(
    '/schemas',
    { schema: { querystring: listSchemasQuery, response: { 200: z.array(recordResponse) } } },
    async (req) => {
      const q = req.query as z.infer<typeof listSchemasQuery>;
      return schemasRepo(db).list(req.orgId, { kind: q.kind, status: q.status });
    },
  );

  r.get(
    '/schemas/:id',
    { schema: { params: idParam, response: { 200: recordResponse } } },
    async (req) => {
      const { id } = req.params as z.infer<typeof idParam>;
      const row = await schemasRepo(db).getById(req.orgId, id);
      if (!row) throw notFound(`schema ${id} not found`);
      return row;
    },
  );
}
