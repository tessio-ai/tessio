// SPDX-License-Identifier: AGPL-3.0-only

import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Db } from '@tessio/db';
import { formsRepo, schemasRepo } from '@tessio/db';
import { portalTheme, formDefinition, validateFormAgainstSchema } from '@tessio/shared';
import type { SchemaDefinition, FormDefinition } from '@tessio/shared';
import { badRequest, notFound, conflict } from '../errors';

const idParam = z.object({ id: z.string().uuid() });
const createBody = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  icon: z.string().optional(),
  categoryKey: z.string().min(1),
  targetSchemaId: z.string().uuid(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  theme: portalTheme,
  definition: formDefinition.optional(),
});
const updateBody = z.object({
  name: z.string().min(1).optional(),
  key: z.string().min(1).optional(),
  description: z.string().optional(),
  icon: z.string().optional(),
  categoryKey: z.string().min(1).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  theme: portalTheme.optional(),
  definition: formDefinition.optional(),
});
const formResponse = z.record(z.unknown());

/** Resolve the target schema (must be a ticket type in the org) and validate the def against it. */
async function assertValidAgainstSchema(db: Db, orgId: string, targetSchemaId: string, definition: FormDefinition) {
  const schema = await schemasRepo(db).getById(orgId, targetSchemaId);
  if (!schema || schema.kind !== 'ticket') throw badRequest('targetSchemaId must reference a ticket-type schema in this org');
  const result = validateFormAgainstSchema(definition, schema.definition as SchemaDefinition);
  if (!result.ok) throw badRequest(result.errors.join('; '));
}

/** Admin-only forms CRUD. Caller must be guarded by requireRole('admin'). */
export function registerFormRoutes(app: FastifyInstance, db: Db): void {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get('/forms', { schema: { response: { 200: z.array(formResponse) } } }, async (req) => {
    return formsRepo(db).list(req.orgId);
  });

  r.post('/forms', { schema: { body: createBody, response: { 201: formResponse } } }, async (req, reply) => {
    const b = req.body;
    await assertValidAgainstSchema(db, req.orgId, b.targetSchemaId, b.definition ?? { sections: [] });
    if (await formsRepo(db).findByKey(req.orgId, b.key)) throw conflict(`A form with key "${b.key}" already exists`);
    const created = await formsRepo(db).create({
      orgId: req.orgId,
      key: b.key, name: b.name, description: b.description, icon: b.icon,
      categoryKey: b.categoryKey, targetSchemaId: b.targetSchemaId,
      status: b.status ?? 'draft', theme: b.theme, definition: b.definition ?? { sections: [] },
      createdBy: req.user.id, updatedBy: req.user.id,
    });
    reply.code(201);
    return created;
  });

  r.get('/forms/:id', { schema: { params: idParam, response: { 200: formResponse } } }, async (req) => {
    const { id } = req.params as z.infer<typeof idParam>;
    const form = await formsRepo(db).findById(req.orgId, id);
    if (!form) throw notFound(`form ${id} not found`);
    return form;
  });

  r.patch('/forms/:id', { schema: { params: idParam, body: updateBody, response: { 200: formResponse } } }, async (req) => {
    const { id } = req.params as z.infer<typeof idParam>;
    const existing = await formsRepo(db).findById(req.orgId, id);
    if (!existing) throw notFound(`form ${id} not found`);
    const b = req.body;
    const nextDef = (b.definition ?? existing.definition) as FormDefinition;
    if (b.definition || b.status === 'published') {
      await assertValidAgainstSchema(db, req.orgId, existing.targetSchemaId, nextDef);
    }
    if (b.key && b.key !== existing.key) {
      const dup = await formsRepo(db).findByKey(req.orgId, b.key);
      if (dup && dup.id !== id) throw conflict(`A form with key "${b.key}" already exists`);
    }
    if (b.name || b.key) {
      await schemasRepo(db).update(req.orgId, existing.targetSchemaId, {
        ...(b.name ? { name: b.name } : {}),
        ...(b.key ? { key: b.key } : {}),
      });
    }
    return formsRepo(db).update(req.orgId, id, { ...b, updatedBy: req.user.id });
  });

  r.delete('/forms/:id', { schema: { params: idParam, response: { 200: formResponse } } }, async (req) => {
    const { id } = req.params as z.infer<typeof idParam>;
    const existing = await formsRepo(db).findById(req.orgId, id);
    if (!existing) throw notFound(`form ${id} not found`);
    return formsRepo(db).archive(req.orgId, id);
  });
}
