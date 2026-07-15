// SPDX-License-Identifier: AGPL-3.0-only

/**
 * End-to-end proof of the edition gate: in the Community edition the Enterprise
 * routes simply do not exist (no ee plugin is loaded), while /me/entitlements
 * reports them disabled with the free seat allotment. The enterprise-enabled
 * counterparts of these routes are covered in the sso-settings / audit
 * integration tests; seat-limit enforcement is covered in
 * seat-limit.integration.test.ts.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { buildTestApp, resetDb, seedOrgAndSchema, createTestDb, loginAs } from '../testing/harness';

process.env.TESSIO_SECRET_KEY = Buffer.alloc(32, 1).toString('base64');

const db = createTestDb();
// No TESSIO_EDITION → community (default). buildTestApp loads no ee plugin.
const { app, teardown } = buildTestApp();

describe('community edition gating', () => {
  beforeAll(async () => {
    await app.ready();
  });
  beforeEach(async () => {
    await resetDb(db);
  });
  afterAll(async () => {
    await db.$client.end();
    await teardown();
  });

  it('does NOT expose enterprise routes (SSO settings, audit viewer) → 404', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    const admin = await loginAs(app, db, { orgId, role: 'admin' });

    const audit = await app.inject({ method: 'GET', url: '/api/v1/audit-log', headers: { cookie: admin.cookie } });
    expect(audit.statusCode).toBe(404);

    const sso = await app.inject({ method: 'GET', url: '/api/v1/sso-settings', headers: { cookie: admin.cookie } });
    expect(sso.statusCode).toBe(404);

    // Public SSO route is also absent in community.
    const ssoInfo = await app.inject({ method: 'GET', url: '/api/v1/auth/sso/info' });
    expect(ssoInfo.statusCode).toBe(404);
  });

  it('/me/entitlements reports community: all enterprise features off, free seat allotment', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    const admin = await loginAs(app, db, { orgId, role: 'admin' });

    const res = await app.inject({ method: 'GET', url: '/api/v1/me/entitlements', headers: { cookie: admin.cookie } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.edition).toBe('community');
    expect(body.seatLimit).toBe(5); // community = the free allotment
    expect(body.seatsUsed).toBeGreaterThanOrEqual(1); // at least the logged-in admin
    expect(body.features.sso).toBe(false);
    expect(body.features.audit_log).toBe(false);
  });
});
