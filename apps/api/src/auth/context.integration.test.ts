// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { buildTestApp, resetDb, seedOrgAndSchema, createTestDb, loginAs } from '../testing/harness';

const db = createTestDb();
const { app, teardown } = buildTestApp();

describe('auth context', () => {
  beforeEach(async () => { await resetDb(db); });
  afterAll(async () => { await db.$client.end(); await teardown(); });

  it('rejects requests without a session', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/_whoami' });
    expect(res.statusCode).toBe(401);
  });

  it('derives orgId from the session', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    const { cookie } = await loginAs(app, db, { orgId, role: 'agent' });
    const res = await app.inject({ method: 'GET', url: '/api/v1/_whoami', headers: { cookie } });
    expect(res.statusCode).toBe(200);
    expect(res.json().orgId).toBe(orgId);
  });
});
