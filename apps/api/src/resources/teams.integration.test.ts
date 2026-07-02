// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { buildTestApp, resetDb, seedOrgAndSchema, createTestDb, loginAs } from '../testing/harness';
import { ticketsRepo } from '@tessio/db';

const db = createTestDb();
const { app, teardown } = buildTestApp();

describe('teams resource', () => {
  beforeEach(async () => { await resetDb(db); });
  afterAll(async () => { await db.$client.end(); await teardown(); });

  it('lets an agent list teams but not create them', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    const { cookie } = await loginAs(app, db, { orgId, role: 'agent' });
    expect((await app.inject({ method: 'GET', url: '/api/v1/teams', headers: { cookie } })).statusCode).toBe(200);
    const create = await app.inject({ method: 'POST', url: '/api/v1/teams', headers: { cookie }, payload: { name: 'Network' } });
    expect(create.statusCode).toBe(403);
  });

  it('admin can create, rename, and delete a team; delete un-assigns tickets', async () => {
    const { orgId, schemaId, schemaVersion } = await seedOrgAndSchema(db, 'ticket');
    const { cookie } = await loginAs(app, db, { orgId, role: 'admin' });
    const team = (await app.inject({ method: 'POST', url: '/api/v1/teams', headers: { cookie }, payload: { name: 'IT Ops' } })).json();
    expect(team.name).toBe('IT Ops');
    const ticket = await ticketsRepo(db).create({ orgId, schemaId, schemaVersion, teamId: team.id });
    const renamed = await app.inject({ method: 'PATCH', url: `/api/v1/teams/${team.id}`, headers: { cookie }, payload: { name: 'Ops' } });
    expect(renamed.json().name).toBe('Ops');
    const del = await app.inject({ method: 'DELETE', url: `/api/v1/teams/${team.id}`, headers: { cookie } });
    expect(del.statusCode).toBe(204);
    expect((await ticketsRepo(db).getById(orgId, ticket.id))?.teamId).toBeNull();
  });

  it('rejects a duplicate team name with 409', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    const { cookie } = await loginAs(app, db, { orgId, role: 'admin' });
    await app.inject({ method: 'POST', url: '/api/v1/teams', headers: { cookie }, payload: { name: 'Dup' } });
    const second = await app.inject({ method: 'POST', url: '/api/v1/teams', headers: { cookie }, payload: { name: 'Dup' } });
    expect(second.statusCode).toBe(409);
  });
});
