// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { buildTestApp, resetDb, seedOrgAndSchema, createTestDb, loginAs } from '../testing/harness';
import { schemasRepo, teamsRepo, teamSchemasRepo, teamMembersRepo, ticketsRepo } from '@tessio/db';

const db = createTestDb();
const { app, teardown } = buildTestApp();

/**
 * Regression: an agent may only touch tickets whose schema is unscoped or assigned
 * to one of their teams. This must hold on by-id reads/writes and ticket
 * sub-resources — not just the list/query endpoints — otherwise an agent who knows
 * a ticket's UUID can read or mutate a ticket walled off from their team.
 */
describe('ticket team-scope isolation (by-id + sub-resources)', () => {
  beforeEach(async () => {
    await resetDb(db);
  });
  afterAll(async () => {
    await db.$client.end();
    await teardown();
  });

  async function setup() {
    // schemaId (from seed) is unscoped → visible to every agent (the control case).
    const { orgId, schemaId: openSchemaId, schemaVersion } = await seedOrgAndSchema(db, 'ticket');
    const agent = await loginAs(app, db, { orgId, role: 'agent' });
    const admin = await loginAs(app, db, { orgId, role: 'admin' });

    // A second schema assigned to a team the agent is NOT a member of → walled off.
    const walledSchema = await schemasRepo(db).create({
      orgId, kind: 'ticket', key: 'ticket_hr', name: 'HR ticket', status: 'published', definition: { fields: [] },
    });
    const otherTeam = await teamsRepo(db).create({ orgId, name: 'HR' });
    await teamSchemasRepo(db).add(otherTeam.id, walledSchema.id);

    // The agent belongs to a different team (with the open schema); it does not grant
    // visibility into the HR schema.
    const agentTeam = await teamsRepo(db).create({ orgId, name: 'IT' });
    await teamMembersRepo(db).add(agentTeam.id, agent.userId);

    const walledTicket = await ticketsRepo(db).create({
      orgId, schemaId: walledSchema.id, schemaVersion: walledSchema.version, data: { title: 'HR confidential' },
    });
    const openTicket = await ticketsRepo(db).create({
      orgId, schemaId: openSchemaId, schemaVersion, data: { title: 'Open ticket' },
    });
    return { agent, admin, walledTicket, openTicket };
  }

  it('lets the agent read a ticket of an unscoped schema (control)', async () => {
    const { agent, openTicket } = await setup();
    const res = await app.inject({ method: 'GET', url: `/api/v1/tickets/${openTicket.id}`, headers: { cookie: agent.cookie } });
    expect(res.statusCode).toBe(200);
  });

  it('hides a walled-off ticket from GET/PATCH/DELETE by id', async () => {
    const { agent, walledTicket } = await setup();
    const cookie = agent.cookie;
    const jsonH = { cookie, 'content-type': 'application/json' };
    expect((await app.inject({ method: 'GET', url: `/api/v1/tickets/${walledTicket.id}`, headers: { cookie } })).statusCode).toBe(404);
    expect((await app.inject({ method: 'PATCH', url: `/api/v1/tickets/${walledTicket.id}`, headers: jsonH, payload: { status: 'closed' } })).statusCode).toBe(404);
    expect((await app.inject({ method: 'DELETE', url: `/api/v1/tickets/${walledTicket.id}`, headers: { cookie } })).statusCode).toBe(404);

    // The PATCH/DELETE must not have taken effect (admin can still see it live).
    const row = await ticketsRepo(db).getById(walledTicket.orgId as string, walledTicket.id);
    expect(row?.status).not.toBe('closed');
    expect(row?.deletedAt ?? null).toBeNull();
  });

  it('hides a walled-off ticket from comments and activity sub-resources', async () => {
    const { agent, walledTicket } = await setup();
    const cookie = agent.cookie;
    const jsonH = { cookie, 'content-type': 'application/json' };
    expect((await app.inject({ method: 'GET', url: `/api/v1/tickets/${walledTicket.id}/comments`, headers: { cookie } })).statusCode).toBe(404);
    expect((await app.inject({ method: 'POST', url: `/api/v1/tickets/${walledTicket.id}/comments`, headers: jsonH, payload: { body: 'sneaky' } })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: `/api/v1/tickets/${walledTicket.id}/activity`, headers: { cookie } })).statusCode).toBe(404);
  });

  it('still lets an admin read the walled-off ticket', async () => {
    const { admin, walledTicket } = await setup();
    const res = await app.inject({ method: 'GET', url: `/api/v1/tickets/${walledTicket.id}`, headers: { cookie: admin.cookie } });
    expect(res.statusCode).toBe(200);
  });
});
