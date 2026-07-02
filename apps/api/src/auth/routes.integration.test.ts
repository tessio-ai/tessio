// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { buildTestApp, resetDb, createTestDb } from '../testing/harness';
import { usersRepo, hashPassword } from '@tessio/db';
import { orgs } from '@tessio/db';

const db = createTestDb();
const { app, teardown } = buildTestApp();

async function seedLogin(role: 'admin' | 'agent' | 'requester' = 'agent') {
  const [org] = await db.insert(orgs).values({ name: 'Org', slug: `o-${crypto.randomUUID()}` }).returning();
  const email = `${crypto.randomUUID()}@t.io`;
  await usersRepo(db).create({ orgId: org.id, email, name: 'U', role, passwordHash: await hashPassword('pw') });
  return { email, orgId: org.id };
}

describe('auth routes', () => {
  beforeEach(async () => { await resetDb(db); });
  afterAll(async () => { await db.$client.end(); await teardown(); });

  it('logs in with valid credentials and sets a cookie', async () => {
    const { email } = await seedLogin();
    const res = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email, password: 'pw' } });
    expect(res.statusCode).toBe(200);
    expect(res.json().email).toBe(email);
    expect(res.headers['set-cookie']).toMatch(/tessio_session=/);
  });

  it('rejects a wrong password with a generic 401', async () => {
    const { email } = await seedLogin();
    const res = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email, password: 'nope' } });
    expect(res.statusCode).toBe(401);
    expect(res.json().detail).toBe('Invalid email or password');
  });

  it('me returns the user when authenticated, 401 otherwise', async () => {
    const { email } = await seedLogin();
    const login = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email, password: 'pw' } });
    const cookie = login.headers['set-cookie'] as string;
    const me = await app.inject({ method: 'GET', url: '/api/v1/auth/me', headers: { cookie } });
    expect(me.statusCode).toBe(200);
    expect(me.json().email).toBe(email);
    const anon = await app.inject({ method: 'GET', url: '/api/v1/auth/me' });
    expect(anon.statusCode).toBe(401);
  });

  it('logout clears the session', async () => {
    const { email } = await seedLogin();
    const login = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email, password: 'pw' } });
    const cookie = login.headers['set-cookie'] as string;
    const out = await app.inject({ method: 'POST', url: '/api/v1/auth/logout', headers: { cookie } });
    expect(out.statusCode).toBe(204);
    const me = await app.inject({ method: 'GET', url: '/api/v1/auth/me', headers: { cookie } });
    expect(me.statusCode).toBe(401);
  });

  it('rejects a disabled account with the same generic 401', async () => {
    const [org] = await db.insert(orgs).values({ name: 'Org', slug: `o-${crypto.randomUUID()}` }).returning();
    const email = `${crypto.randomUUID()}@t.io`;
    const u = await usersRepo(db).create({ orgId: org.id, email, name: 'U', role: 'agent', passwordHash: await hashPassword('pw') });
    await usersRepo(db).setStatus(u.id, 'disabled');
    const res = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email, password: 'pw' } });
    expect(res.statusCode).toBe(401);
    expect(res.json().detail).toBe('Invalid email or password');
  });
});
