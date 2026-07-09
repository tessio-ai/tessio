// SPDX-License-Identifier: AGPL-3.0-only

import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Db } from '@tessio/db';
import { teamsRepo, teamMembersRepo, teamSchemasRepo } from '@tessio/db';
import { notFound, conflict } from '../errors';

const teamOut = z.object({
  id: z.string(),
  name: z.string(),
  emailAddress: z.string().nullable(),
  emailName: z.string().nullable(),
  memberCount: z.number(),
  schemaCount: z.number(),
  createdAt: z.coerce.string(),
});
const nameBody = z.object({ name: z.string().min(1) });
const patchBody = z.object({
  name: z.string().min(1).optional(),
  emailAddress: z.string().email().nullable().optional(),
  emailName: z.string().nullable().optional(),
});
const idParam = z.object({ id: z.string().uuid() });

type TeamRow = { id: string; name: string; emailAddress: string | null; emailName: string | null; createdAt: Date | string; [k: string]: unknown };
const safe = (t: TeamRow, memberCount: number, schemaCount: number) => ({
  id: t.id,
  name: t.name,
  emailAddress: t.emailAddress ?? null,
  emailName: t.emailName ?? null,
  memberCount,
  schemaCount,
  createdAt: String(t.createdAt),
});

/** GET /teams (list) — reachable by agent + admin. Caller must already be guarded for read. */
export function registerTeamReadRoutes(app: FastifyInstance, db: Db): void {
  const r = app.withTypeProvider<ZodTypeProvider>();
  r.get('/teams', { schema: { response: { 200: z.array(teamOut) } } }, async (req) => {
    const rows = await teamsRepo(db).list(req.orgId);
    const results = await Promise.all(rows.map(async (t) => {
      const members = await teamMembersRepo(db).listByTeam(t.id);
      const schemas = await teamSchemasRepo(db).listByTeam(t.id);
      return safe(t as TeamRow, members.length, schemas.length);
    }));
    return results;
  });
}

/** Admin-only team management. Caller must already be guarded by requireRole('admin'). */
export function registerTeamRoutes(app: FastifyInstance, db: Db): void {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.post('/teams', { schema: { body: nameBody, response: { 201: teamOut } } }, async (req, reply) => {
    const existing = await teamsRepo(db).list(req.orgId);
    if (existing.some((t) => t.name === req.body.name)) throw conflict('A team with that name already exists');
    const created = await teamsRepo(db).create({ orgId: req.orgId, name: req.body.name });
    reply.code(201);
    return safe(created as TeamRow, 0, 0);
  });

  r.patch('/teams/:id', { schema: { params: idParam, body: patchBody, response: { 200: teamOut } } }, async (req) => {
    const { id } = req.params;
    const found = await teamsRepo(db).findById(req.orgId, id);
    if (!found) throw notFound(`teams ${id} not found`);
    const others = (await teamsRepo(db).list(req.orgId)).filter((t) => t.id !== id);
    if (req.body.name !== undefined && others.some((t) => t.name === req.body.name)) {
      throw conflict('A team with that name already exists');
    }
    if (req.body.emailAddress != null && others.some((t) => t.emailAddress?.toLowerCase() === req.body.emailAddress!.toLowerCase())) {
      throw conflict('Another team already uses that email address');
    }
    const patch: { name?: string; emailAddress?: string | null; emailName?: string | null } = {};
    if (req.body.name !== undefined) patch.name = req.body.name;
    if (req.body.emailAddress !== undefined) patch.emailAddress = req.body.emailAddress?.toLowerCase() ?? null;
    if (req.body.emailName !== undefined) patch.emailName = req.body.emailName;
    const row = await teamsRepo(db).update(req.orgId, id, patch);
    const members = await teamMembersRepo(db).listByTeam(id);
    const schemas = await teamSchemasRepo(db).listByTeam(id);
    return safe(row as TeamRow, members.length, schemas.length);
  });

  r.delete('/teams/:id', { schema: { params: idParam, response: { 204: z.null() } } }, async (req, reply) => {
    const { id } = req.params;
    const found = await teamsRepo(db).findById(req.orgId, id);
    if (!found) throw notFound(`teams ${id} not found`);
    await teamsRepo(db).remove(req.orgId, id);
    reply.code(204);
    return null;
  });
}
