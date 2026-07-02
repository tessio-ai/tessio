// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { buildTestApp, resetDb, seedOrgAndSchema, createTestDb, loginAs } from '../testing/harness';

const db = createTestDb();
const { app, teardown } = buildTestApp();

describe('schemas resource', () => {
  beforeEach(async () => {
    await resetDb(db);
  });
  afterAll(async () => {
    await db.$client.end();
    await teardown();
  });

  it('lists published ticket schemas for the org', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    const { cookie } = await loginAs(app, db, { orgId, role: 'agent' });
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/schemas?kind=ticket&status=published',
      headers: { cookie },
    });
    expect(res.statusCode).toBe(200);
    const rows = res.json();
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe('ticket');
    expect(rows[0].definition).toEqual({ fields: [] });
  });

  it('gets a schema by id', async () => {
    const { orgId, schemaId } = await seedOrgAndSchema(db, 'ticket');
    const { cookie } = await loginAs(app, db, { orgId, role: 'agent' });
    const res = await app.inject({ method: 'GET', url: `/api/v1/schemas/${schemaId}`, headers: { cookie } });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe(schemaId);
  });

  it('returns 404 for a schema in another org', async () => {
    const a = await seedOrgAndSchema(db, 'ticket');
    const b = await seedOrgAndSchema(db, 'ticket');
    const { cookie: cookieB } = await loginAs(app, db, { orgId: b.orgId, role: 'agent' });
    const res = await app.inject({ method: 'GET', url: `/api/v1/schemas/${a.schemaId}`, headers: { cookie: cookieB } });
    expect(res.statusCode).toBe(404);
  });
});
