// SPDX-License-Identifier: AGPL-3.0-only

import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Db } from '@tessio/db';
import { teamSchemasRepo, teamsRepo } from '@tessio/db';
import { notFound, conflict } from '../errors';

const assignOut = z.object({ teamId: z.string(), schemaId: z.string(), createdAt: z.coerce.string() });
const teamIdParam = z.object({ id: z.string().uuid() });
const schemaIdParam = z.object({ id: z.string().uuid(), schemaId: z.string().uuid() });
const addBody = z.object({ schemaId: z.string().uuid() });

export function registerTeamSchemaRoutes(app: FastifyInstance, db: Db): void {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get('/teams/:id/schemas', { schema: { params: teamIdParam, response: { 200: z.array(assignOut) } } }, async (req) => {
    const { id } = req.params;
    const team = await teamsRepo(db).findById(req.orgId, id);
    if (!team) throw notFound(`team ${id} not found`);
    const rows = await teamSchemasRepo(db).listByTeam(id);
    return rows.map((r) => ({ teamId: r.teamId, schemaId: r.schemaId, createdAt: String(r.createdAt) }));
  });

  r.post('/teams/:id/schemas', { schema: { params: teamIdParam, body: addBody, response: { 201: assignOut } } }, async (req, reply) => {
    const { id } = req.params;
    const team = await teamsRepo(db).findById(req.orgId, id);
    if (!team) throw notFound(`team ${id} not found`);
    const row = await teamSchemasRepo(db).add(id, req.body.schemaId);
    if (!row) throw conflict('Schema is already assigned to this team');
    reply.code(201);
    return { teamId: row.teamId, schemaId: row.schemaId, createdAt: String(row.createdAt) };
  });

  r.delete('/teams/:id/schemas/:schemaId', { schema: { params: schemaIdParam, response: { 204: z.null() } } }, async (req, reply) => {
    const { id, schemaId } = req.params;
    await teamSchemasRepo(db).remove(id, schemaId);
    reply.code(204);
    return null;
  });
}
