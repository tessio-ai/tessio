// SPDX-License-Identifier: AGPL-3.0-only

import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Db } from '@tessio/db';
import { secretsRepo } from '@tessio/db';
import { encryptSecret } from '@tessio/ai';
import { SECRET_NAME_RE } from '@tessio/shared';
import { requireSecretKey } from '../ai/secret';
import { ApiError } from '../errors';

const nameParam = z.object({ name: z.string() });
const presented = z.object({
  name: z.string(),
  hint: z.string(),
  updatedAt: z.string(),
  updatedBy: z.string().nullable(),
});
const createBody = z.object({ name: z.string().regex(SECRET_NAME_RE, 'Use lowercase letters, digits, and underscores.'), value: z.string().min(4) });
const replaceBody = z.object({ value: z.string().min(4) });

function present(row: { name: string; hint: string; updatedAt: Date; updatedBy: string | null | undefined }) {
  return {
    name: row.name,
    hint: row.hint,
    updatedAt: row.updatedAt.toISOString(),
    updatedBy: row.updatedBy ?? null,
  };
}

/** Admin-only secrets store. Caller must be guarded by requireRole('admin'). */
export function registerSecretsRoutes(app: FastifyInstance, db: Db): void {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const repo = secretsRepo(db);

  r.get('/secrets', { schema: { response: { 200: z.array(presented) } } }, async (req) => {
    return (await repo.list(req.orgId)).map(present);
  });

  r.post('/secrets', { schema: { body: createBody, response: { 201: presented } } }, async (req, reply) => {
    const { name, value } = req.body;
    if (await repo.getByName(req.orgId, name)) throw new ApiError(409, 'Duplicate Secret', `A secret named "${name}" already exists.`);
    const row = await repo.create({
      orgId: req.orgId,
      name,
      valueCiphertext: encryptSecret(value, requireSecretKey()),
      hint: value.slice(-4),
      createdBy: req.user.id,
    });
    reply.code(201);
    return present(row);
  });

  r.put('/secrets/:name', { schema: { params: nameParam, body: replaceBody, response: { 200: presented } } }, async (req) => {
    const { value } = req.body;
    const row = await repo.updateValue(req.orgId, req.params.name, encryptSecret(value, requireSecretKey()), value.slice(-4), req.user.id);
    if (!row) throw new ApiError(404, 'Not Found', `No secret named "${req.params.name}".`);
    return present(row);
  });

  r.delete('/secrets/:name', { schema: { params: nameParam, response: { 204: z.null() } } }, async (req, reply) => {
    await repo.remove(req.orgId, req.params.name);
    reply.code(204);
    return null;
  });
}
