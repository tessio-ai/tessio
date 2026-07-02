// SPDX-License-Identifier: AGPL-3.0-only

import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Db } from '@tessio/db';
import { schemasRepo, formsRepo } from '@tessio/db';
import { schemaDefinition } from '@tessio/shared';
import type { SchemaDefinition } from '@tessio/shared';
import { notFound, conflict } from '../errors';

const idParam = z.object({ id: z.string().uuid() });
const patchBody = z.object({
  definition: schemaDefinition.optional(),
  name: z.string().min(1).optional(),
  key: z.string().min(1).optional(),
});
const schemaResponse = z.record(z.unknown());

const createBody = z.object({
  name: z.string().min(1),
  key: z.string().min(1).optional(),
  kind: z.enum(['ticket', 'asset']).optional(),
  definition: schemaDefinition.optional(),
});

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'ticket';
}

const DEFAULT_DEFINITION: SchemaDefinition = {
  fields: [{ key: 'title', label: 'Title', type: 'text', required: true, order: 0, width: 'full' }],
};

/** Admin-only schema field editing. Caller must be guarded by requireRole('admin'). */
export function registerSchemaWriteRoutes(app: FastifyInstance, db: Db): void {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.patch('/schemas/:id', { schema: { params: idParam, body: patchBody, response: { 200: schemaResponse } } }, async (req) => {
    const { id } = req.params as z.infer<typeof idParam>;
    const repo = schemasRepo(db);
    const existing = await repo.getById(req.orgId, id);
    if (!existing) throw notFound(`schema ${id} not found`);

    if (req.body.definition) {
      const nextKeys = new Set(req.body.definition.fields.map((f) => f.key));
      for (const prev of existing.definition.fields) {
        const next = req.body.definition.fields.find((f) => f.key === prev.key);
        const removed = !nextKeys.has(prev.key);
        const retyped = next && next.type !== prev.type;
        if (removed || retyped) {
          const usedBy = await formsRepo(db).fieldReferencedByForm(req.orgId, id, prev.key);
          if (usedBy) throw conflict(`field "${prev.key}" is used by form "${usedBy}"`);
        }
      }
      await repo.updateDefinition(req.orgId, id, req.body.definition);
    }

    if (req.body.name || req.body.key) {
      await repo.update(req.orgId, id, {
        ...(req.body.name ? { name: req.body.name } : {}),
        ...(req.body.key ? { key: req.body.key } : {}),
      });
    }

    return repo.getById(req.orgId, id);
  });

  r.post('/schemas', { schema: { body: createBody, response: { 201: schemaResponse } } }, async (req, reply) => {
    const b = req.body;
    const created = await schemasRepo(db).create({
      orgId: req.orgId,
      kind: b.kind ?? 'ticket',
      key: b.key ?? slugify(b.name),
      name: b.name,
      status: 'published',
      definition: b.definition ?? DEFAULT_DEFINITION,
    });
    reply.code(201);
    return created;
  });
}
