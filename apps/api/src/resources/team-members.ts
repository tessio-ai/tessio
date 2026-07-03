// SPDX-License-Identifier: AGPL-3.0-only

import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Db } from '@tessio/db';
import { teamMembersRepo, teamsRepo, usersRepo } from '@tessio/db';
import { notFound, conflict } from '../errors';

const memberOut = z.object({ teamId: z.string(), userId: z.string(), createdAt: z.coerce.string() });
const teamIdParam = z.object({ id: z.string().uuid() });
const memberIdParam = z.object({ id: z.string().uuid(), userId: z.string().uuid() });
const addBody = z.object({ userId: z.string().uuid() });

export function registerTeamMemberRoutes(app: FastifyInstance, db: Db): void {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get('/teams/:id/members', { schema: { params: teamIdParam, response: { 200: z.array(memberOut) } } }, async (req) => {
    const { id } = req.params;
    const team = await teamsRepo(db).findById(req.orgId, id);
    if (!team) throw notFound(`team ${id} not found`);
    const rows = await teamMembersRepo(db).listByTeam(id);
    return rows.map((r) => ({ teamId: r.teamId, userId: r.userId, createdAt: String(r.createdAt) }));
  });

  r.post('/teams/:id/members', { schema: { params: teamIdParam, body: addBody, response: { 201: memberOut } } }, async (req, reply) => {
    const { id } = req.params;
    const team = await teamsRepo(db).findById(req.orgId, id);
    if (!team) throw notFound(`team ${id} not found`);
    const user = await usersRepo(db).findById(req.body.userId);
    if (!user || user.orgId !== req.orgId) throw notFound(`user ${req.body.userId} not found`);
    const row = await teamMembersRepo(db).add(id, req.body.userId);
    if (!row) throw conflict('User is already a member of this team');
    reply.code(201);
    return { teamId: row.teamId, userId: row.userId, createdAt: String(row.createdAt) };
  });

  r.delete('/teams/:id/members/:userId', { schema: { params: memberIdParam, response: { 204: z.null() } } }, async (req, reply) => {
    const { id, userId } = req.params;
    // Confirm the team belongs to the caller's org before mutating it (the repo
    // remove() filters by team id only), matching the GET/POST handlers.
    const team = await teamsRepo(db).findById(req.orgId, id);
    if (!team) throw notFound(`team ${id} not found`);
    await teamMembersRepo(db).remove(id, userId);
    reply.code(204);
    return null;
  });
}
