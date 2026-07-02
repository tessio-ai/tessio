// SPDX-License-Identifier: AGPL-3.0-only

import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Db } from '@tessio/db';
import { orgsRepo } from '@tessio/db';
import { notFound } from '../errors';

const orgOut = z.object({ id: z.string(), name: z.string(), slug: z.string() });

export function registerOrgReadRoutes(app: FastifyInstance, db: Db): void {
  const r = app.withTypeProvider<ZodTypeProvider>();
  r.get('/org', { schema: { response: { 200: orgOut } } }, async (req) => {
    const org = await orgsRepo(db).findById(req.orgId);
    if (!org) throw notFound('org not found');
    return { id: org.id, name: org.name, slug: org.slug };
  });
}

export function registerOrgWriteRoutes(app: FastifyInstance, db: Db): void {
  const r = app.withTypeProvider<ZodTypeProvider>();
  r.patch('/org', { schema: { body: z.object({ name: z.string().min(1) }), response: { 200: orgOut } } }, async (req) => {
    const org = await orgsRepo(db).update(req.orgId, { name: req.body.name });
    if (!org) throw notFound('org not found');
    return { id: org.id, name: org.name, slug: org.slug };
  });
}
