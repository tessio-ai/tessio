// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { buildTestApp, resetDb, seedOrgAndSchema, createTestDb, loginAs } from '../testing/harness';

const db = createTestDb();
const { app, teardown } = buildTestApp();

async function setup() {
  const { orgId, schemaId, schemaVersion } = await seedOrgAndSchema(db, 'ticket');
  const requester = await loginAs(app, db, { orgId, role: 'requester' });
  const agent = await loginAs(app, db, { orgId, role: 'agent' });
  return { orgId, schemaId, schemaVersion, requester, agent };
}

describe('RBAC', () => {
  beforeEach(async () => { await resetDb(db); });
  afterAll(async () => { await db.$client.end(); await teardown(); });

  it('blocks a requester from listing assets (403)', async () => {
    const { requester } = await setup();
    const res = await app.inject({ method: 'GET', url: '/api/v1/assets', headers: { cookie: requester.cookie } });
    expect(res.statusCode).toBe(403);
  });

  it('lets a requester create a ticket but forces requesterId to self', async () => {
    const { schemaId, schemaVersion, requester } = await setup();
    const res = await app.inject({
      method: 'POST', url: '/api/v1/tickets', headers: { cookie: requester.cookie },
      payload: { schemaId, schemaVersion, requesterId: '00000000-0000-0000-0000-000000000000', data: {} },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().requesterId).toBe(requester.userId);
  });

  it('scopes requester ticket reads to their own', async () => {
    const { schemaId, schemaVersion, requester, agent } = await setup();
    const other = await app.inject({ method: 'POST', url: '/api/v1/tickets', headers: { cookie: agent.cookie }, payload: { schemaId, schemaVersion, data: {} } });
    const otherId = other.json().id;
    await app.inject({ method: 'POST', url: '/api/v1/tickets', headers: { cookie: requester.cookie }, payload: { schemaId, schemaVersion, data: {} } });

    const list = await app.inject({ method: 'GET', url: '/api/v1/tickets', headers: { cookie: requester.cookie } });
    expect(list.json().rows.every((t: { requesterId: string }) => t.requesterId === requester.userId)).toBe(true);

    const getOther = await app.inject({ method: 'GET', url: `/api/v1/tickets/${otherId}`, headers: { cookie: requester.cookie } });
    expect(getOther.statusCode).toBe(404);
  });

  it('forbids a requester from patching a ticket', async () => {
    const { schemaId, schemaVersion, requester } = await setup();
    const own = await app.inject({ method: 'POST', url: '/api/v1/tickets', headers: { cookie: requester.cookie }, payload: { schemaId, schemaVersion, data: {} } });
    const res = await app.inject({ method: 'PATCH', url: `/api/v1/tickets/${own.json().id}`, headers: { cookie: requester.cookie }, payload: { status: 'closed' } });
    expect(res.statusCode).toBe(403);
  });

  it('lets a requester create a form-submission but not list them', async () => {
    await setup();
    const formCtx = await seedOrgAndSchema(db, 'form');
    const reqInFormOrg = await loginAs(app, db, { orgId: formCtx.orgId, role: 'requester' });
    const create = await app.inject({ method: 'POST', url: '/api/v1/form-submissions', headers: { cookie: reqInFormOrg.cookie }, payload: { schemaId: formCtx.schemaId, schemaVersion: formCtx.schemaVersion, data: {} } });
    expect(create.statusCode).toBe(201);
    const list = await app.inject({ method: 'GET', url: '/api/v1/form-submissions', headers: { cookie: reqInFormOrg.cookie } });
    expect(list.statusCode).toBe(403);
  });
});
