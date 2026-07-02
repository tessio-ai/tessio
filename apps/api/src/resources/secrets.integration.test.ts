// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { buildTestApp, resetDb, createTestDb, loginAs } from '../testing/harness';
import { orgs } from '@tessio/db';

process.env.TESSIO_SECRET_KEY = Buffer.alloc(32, 1).toString('base64');

const db = createTestDb();
const { app, teardown } = buildTestApp();

afterAll(async () => { await db.$client.end(); await teardown(); });

async function adminOrg() {
  const [org] = await db.insert(orgs).values({ name: 'Org', slug: `o-${crypto.randomUUID()}` }).returning();
  const admin = await loginAs(app, db, { orgId: org.id, role: 'admin' });
  return { org, admin };
}

describe('secrets routes', () => {
  beforeEach(async () => { await resetDb(db); });

  it('creates a secret, lists it as hint only, never returns the value', async () => {
    const { admin } = await adminOrg();
    const post = await app.inject({
      method: 'POST', url: '/api/v1/secrets',
      headers: { cookie: admin.cookie, 'content-type': 'application/json' },
      payload: { name: 'stripe_key', value: 'sk_live_abcd1234' },
    });
    expect(post.statusCode).toBe(201);
    expect(JSON.stringify(post.json())).not.toContain('sk_live');
    expect(JSON.stringify(post.json())).not.toContain('Ciphertext');

    const list = await app.inject({ method: 'GET', url: '/api/v1/secrets', headers: { cookie: admin.cookie } });
    expect(list.json()).toEqual([expect.objectContaining({ name: 'stripe_key', hint: '1234' })]);
    expect(JSON.stringify(list.json())).not.toContain('Ciphertext');
  });

  it('rejects an invalid name and a duplicate', async () => {
    const { admin } = await adminOrg();
    const bad = await app.inject({
      method: 'POST', url: '/api/v1/secrets',
      headers: { cookie: admin.cookie, 'content-type': 'application/json' },
      payload: { name: 'Bad-Name', value: 'xxxx' },
    });
    expect(bad.statusCode).toBe(400);

    const ok = { method: 'POST' as const, url: '/api/v1/secrets', headers: { cookie: admin.cookie, 'content-type': 'application/json' }, payload: { name: 'dup', value: 'xxxx' } };
    expect((await app.inject(ok)).statusCode).toBe(201);
    expect((await app.inject(ok)).statusCode).toBe(409);
  });

  it('replaces and deletes', async () => {
    const { admin } = await adminOrg();
    await app.inject({ method: 'POST', url: '/api/v1/secrets', headers: { cookie: admin.cookie, 'content-type': 'application/json' }, payload: { name: 'k', value: 'aaaa1111' } });
    const put = await app.inject({ method: 'PUT', url: '/api/v1/secrets/k', headers: { cookie: admin.cookie, 'content-type': 'application/json' }, payload: { value: 'bbbb2222' } });
    expect(put.json()).toMatchObject({ name: 'k', hint: '2222' });
    const del = await app.inject({ method: 'DELETE', url: '/api/v1/secrets/k', headers: { cookie: admin.cookie } });
    expect(del.statusCode).toBe(204);
    expect((await app.inject({ method: 'GET', url: '/api/v1/secrets', headers: { cookie: admin.cookie } })).json()).toEqual([]);
  });

  it('forbids non-admins', async () => {
    const [org] = await db.insert(orgs).values({ name: 'Org', slug: `o-${crypto.randomUUID()}` }).returning();
    const agent = await loginAs(app, db, { orgId: org.id, role: 'agent' });
    const res = await app.inject({ method: 'GET', url: '/api/v1/secrets', headers: { cookie: agent.cookie } });
    expect(res.statusCode).toBe(403);
  });

  it('isolates secrets across orgs', async () => {
    const { admin: adminA } = await adminOrg();
    const { admin: adminB } = await adminOrg();
    await app.inject({ method: 'POST', url: '/api/v1/secrets',
      headers: { cookie: adminA.cookie, 'content-type': 'application/json' },
      payload: { name: 'cross_org', value: 'secret1234' } });
    const list = await app.inject({ method: 'GET', url: '/api/v1/secrets', headers: { cookie: adminB.cookie } });
    expect(list.json()).toEqual([]);
  });
});
