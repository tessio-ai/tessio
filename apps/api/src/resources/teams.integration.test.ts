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

  it('admin can set and clear a team email address', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    const { cookie } = await loginAs(app, db, { orgId, role: 'admin' });
    const team = (await app.inject({ method: 'POST', url: '/api/v1/teams', headers: { cookie }, payload: { name: 'HR' } })).json();
    expect(team.emailAddress).toBeNull();
    const updated = await app.inject({ method: 'PATCH', url: `/api/v1/teams/${team.id}`, headers: { cookie }, payload: { emailAddress: 'HR@Example.com', emailName: 'HR Desk' } });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().emailAddress).toBe('hr@example.com'); // stored lowercased
    expect(updated.json().emailName).toBe('HR Desk');
    const cleared = await app.inject({ method: 'PATCH', url: `/api/v1/teams/${team.id}`, headers: { cookie }, payload: { emailAddress: null, emailName: null } });
    expect(cleared.json().emailAddress).toBeNull();
    expect(cleared.json().emailName).toBeNull();
  });

  it('rejects an email address already used by another team with 409', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    const { cookie } = await loginAs(app, db, { orgId, role: 'admin' });
    const hr = (await app.inject({ method: 'POST', url: '/api/v1/teams', headers: { cookie }, payload: { name: 'HR' } })).json();
    const it_ = (await app.inject({ method: 'POST', url: '/api/v1/teams', headers: { cookie }, payload: { name: 'IT' } })).json();
    await app.inject({ method: 'PATCH', url: `/api/v1/teams/${hr.id}`, headers: { cookie }, payload: { emailAddress: 'hr@example.com' } });
    const dup = await app.inject({ method: 'PATCH', url: `/api/v1/teams/${it_.id}`, headers: { cookie }, payload: { emailAddress: 'HR@example.com' } });
    expect(dup.statusCode).toBe(409);
  });

  it('rejects an invalid team email address with 400', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    const { cookie } = await loginAs(app, db, { orgId, role: 'admin' });
    const team = (await app.inject({ method: 'POST', url: '/api/v1/teams', headers: { cookie }, payload: { name: 'HR' } })).json();
    const bad = await app.inject({ method: 'PATCH', url: `/api/v1/teams/${team.id}`, headers: { cookie }, payload: { emailAddress: 'not-an-email' } });
    expect(bad.statusCode).toBe(400);
  });

  it('rejects a duplicate team name with 409', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    const { cookie } = await loginAs(app, db, { orgId, role: 'admin' });
    await app.inject({ method: 'POST', url: '/api/v1/teams', headers: { cookie }, payload: { name: 'Dup' } });
    const second = await app.inject({ method: 'POST', url: '/api/v1/teams', headers: { cookie }, payload: { name: 'Dup' } });
    expect(second.statusCode).toBe(409);
  });
});
