// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { buildTestApp, resetDb, seedOrgAndSchema, createTestDb, loginAs } from '../testing/harness';

const db = createTestDb();
const { app, teardown } = buildTestApp();

const PNG_DATA_URL = 'data:image/png;base64,iVBORw0KGgo=';

describe('login-settings (admin)', () => {
  beforeEach(async () => { await resetDb(db); });
  afterAll(async () => { await db.$client.end(); await teardown(); });

  it('GET lazily creates defaults; PATCH updates', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    const admin = await loginAs(app, db, { orgId, role: 'admin' });
    const get = await app.inject({ method: 'GET', url: '/api/v1/login-settings', headers: { cookie: admin.cookie } });
    expect(get.statusCode).toBe(200);
    expect(get.json().headline).toBe('Welcome back');
    expect(get.json().brandName).toBe('Tessio');

    const patch = await app.inject({ method: 'PATCH', url: '/api/v1/login-settings', headers: { cookie: admin.cookie },
      payload: { brandName: 'Ebolt', headline: 'Sign in with email', tagline: 'Bring your words, data, and teams together.', logo: PNG_DATA_URL } });
    expect(patch.statusCode).toBe(200);
    expect(patch.json().brandName).toBe('Ebolt');
    expect(patch.json().logo).toBe(PNG_DATA_URL);
  });

  it('PATCH with an empty logo clears it; non-image logos are rejected', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    const admin = await loginAs(app, db, { orgId, role: 'admin' });
    await app.inject({ method: 'PATCH', url: '/api/v1/login-settings', headers: { cookie: admin.cookie }, payload: { logo: PNG_DATA_URL } });

    const cleared = await app.inject({ method: 'PATCH', url: '/api/v1/login-settings', headers: { cookie: admin.cookie }, payload: { logo: '' } });
    expect(cleared.statusCode).toBe(200);
    expect(cleared.json().logo).toBeNull();

    const bad = await app.inject({ method: 'PATCH', url: '/api/v1/login-settings', headers: { cookie: admin.cookie }, payload: { logo: 'https://evil.example/x.png' } });
    expect(bad.statusCode).toBe(400);
  });

  it('forbids an agent (403)', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    const agent = await loginAs(app, db, { orgId, role: 'agent' });
    expect((await app.inject({ method: 'GET', url: '/api/v1/login-settings', headers: { cookie: agent.cookie } })).statusCode).toBe(403);
  });
});

describe('login branding (public)', () => {
  beforeEach(async () => { await resetDb(db); });

  it('returns stock defaults without a session when nothing is configured', async () => {
    await seedOrgAndSchema(db, 'ticket');
    const res = await app.inject({ method: 'GET', url: '/api/v1/auth/login-branding' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      brandName: 'Tessio',
      logo: null,
      headline: 'Welcome back',
      tagline: 'Sign in to your workspace to pick up where you left off.',
    });
  });

  it('reflects admin-configured branding', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    const admin = await loginAs(app, db, { orgId, role: 'admin' });
    await app.inject({ method: 'PATCH', url: '/api/v1/login-settings', headers: { cookie: admin.cookie },
      payload: { brandName: 'Ebolt', logo: PNG_DATA_URL } });

    const res = await app.inject({ method: 'GET', url: '/api/v1/auth/login-branding' });
    expect(res.statusCode).toBe(200);
    expect(res.json().brandName).toBe('Ebolt');
    expect(res.json().logo).toBe(PNG_DATA_URL);
  });
});
