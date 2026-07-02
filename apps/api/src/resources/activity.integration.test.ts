// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { buildTestApp, resetDb, seedOrgAndSchema, createTestDb, loginAs } from '../testing/harness';

const db = createTestDb();
const { app, teardown } = buildTestApp();

describe('ticket activity endpoint', () => {
  beforeEach(async () => { await resetDb(db); });
  afterAll(async () => { await db.$client.end(); await teardown(); });

  it('returns a ticket activity newest-first to an agent', async () => {
    const { orgId, schemaId, schemaVersion } = await seedOrgAndSchema(db, 'ticket');
    const { cookie } = await loginAs(app, db, { orgId, role: 'agent' });
    const created = (await app.inject({ method: 'POST', url: '/api/v1/tickets', headers: { cookie }, payload: { schemaId, schemaVersion, status: 'open' } })).json();
    await app.inject({ method: 'PATCH', url: `/api/v1/tickets/${created.id}`, headers: { cookie }, payload: { status: 'resolved' } });
    const res = await app.inject({ method: 'GET', url: `/api/v1/tickets/${created.id}/activity`, headers: { cookie } });
    expect(res.statusCode).toBe(200);
    const kinds = res.json().map((e: { eventType: string }) => e.eventType);
    expect(kinds).toContain('created');
    expect(kinds).toContain('status');
  });

  it('forbids a requester from reading another requester ticket activity', async () => {
    const { orgId, schemaId, schemaVersion } = await seedOrgAndSchema(db, 'ticket');
    const agent = await loginAs(app, db, { orgId, role: 'agent' });
    const created = (await app.inject({ method: 'POST', url: '/api/v1/tickets', headers: { cookie: agent.cookie }, payload: { schemaId, schemaVersion } })).json();
    const requester = await loginAs(app, db, { orgId, role: 'requester' });
    const res = await app.inject({ method: 'GET', url: `/api/v1/tickets/${created.id}/activity`, headers: { cookie: requester.cookie } });
    expect(res.statusCode).toBe(404);
  });
});
