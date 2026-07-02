// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { buildTestApp, resetDb, seedOrgAndSchema, createTestDb, loginAs } from '../testing/harness';

const db = createTestDb();
const { app, teardown } = buildTestApp();

async function makeTicket(headers: Record<string, string>, schemaId: string, schemaVersion: number, status: string) {
  return (await app.inject({ method: 'POST', url: '/api/v1/tickets', headers, payload: { schemaId, schemaVersion, status } })).json();
}

describe('tickets list + query', () => {
  beforeEach(async () => {
    await resetDb(db);
  });
  afterAll(async () => {
    await db.$client.end();
    await teardown();
  });

  it('GET /tickets paginates with a cursor', async () => {
    const { orgId, schemaId, schemaVersion } = await seedOrgAndSchema(db, 'ticket');
    const { cookie } = await loginAs(app, db, { orgId, role: 'agent' });
    const headers = { cookie };
    for (let i = 0; i < 3; i++) await makeTicket(headers, schemaId, schemaVersion, 'open');
    const page1 = await app.inject({ method: 'GET', url: '/api/v1/tickets?limit=2', headers });
    expect(page1.statusCode).toBe(200);
    const body1 = page1.json();
    expect(body1.rows).toHaveLength(2);
    expect(body1.nextCursor).toBeTruthy();
    const page2 = await app.inject({ method: 'GET', url: `/api/v1/tickets?limit=2&cursor=${encodeURIComponent(body1.nextCursor)}`, headers });
    expect(page2.json().rows).toHaveLength(1);
  });

  it('POST /tickets/query filters by the AST', async () => {
    const { orgId, schemaId, schemaVersion } = await seedOrgAndSchema(db, 'ticket');
    const { cookie } = await loginAs(app, db, { orgId, role: 'agent' });
    const headers = { cookie };
    await makeTicket(headers, schemaId, schemaVersion, 'open');
    await makeTicket(headers, schemaId, schemaVersion, 'closed');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/tickets/query',
      headers,
      payload: { filter: { field: 'status', op: 'eq', value: 'open' }, sort: { field: 'status', dir: 'asc' } },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.rows).toHaveLength(1);
    expect(body.rows[0].status).toBe('open');
  });

  it('rejects an invalid filter body as 400', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    const { cookie } = await loginAs(app, db, { orgId, role: 'agent' });
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/tickets/query',
      headers: { cookie },
      payload: { filter: { field: 'status' } },
    });
    expect(res.statusCode).toBe(400);
  });
});
