// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { buildTestApp, resetDb, createTestDb, loginAs } from '../testing/harness';
import { orgs } from '@tessio/db';

process.env.TESSIO_SECRET_KEY = Buffer.alloc(32, 1).toString('base64');

const db = createTestDb();
const { app, teardown } = buildTestApp();

afterAll(async () => { await db.$client.end(); await teardown(); });

describe('ai settings routes', () => {
  beforeEach(async () => { await resetDb(db); });

  it('returns disabled defaults and never leaks the key', async () => {
    const [org] = await db.insert(orgs).values({ name: 'Org', slug: `o-${crypto.randomUUID()}` }).returning();
    const admin = await loginAs(app, db, { orgId: org.id, role: 'admin' });
    const res = await app.inject({ method: 'GET', url: '/api/v1/ai/settings', headers: { cookie: admin.cookie } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.enabled).toBe(false);
    expect(body.apiKeySet).toBe(false);
    expect(body).not.toHaveProperty('apiKey');
    expect(body).not.toHaveProperty('apiKeyCiphertext');
  });

  it('stores a key as a hint only, never returning the secret', async () => {
    const [org] = await db.insert(orgs).values({ name: 'Org', slug: `o-${crypto.randomUUID()}` }).returning();
    const admin = await loginAs(app, db, { orgId: org.id, role: 'admin' });
    const put = await app.inject({
      method: 'PUT',
      url: '/api/v1/ai/settings',
      headers: { cookie: admin.cookie, 'content-type': 'application/json' },
      payload: { model: 'gpt-4o-mini', embeddingModel: 'text-embedding-3-small', apiKey: 'sk-supersecret-7777', enabled: true, features: { triage: true, similar: true } },
    });
    expect(put.statusCode).toBe(200);
    const body = put.json();
    expect(body.apiKeySet).toBe(true);
    expect(body.apiKeyHint).toBe('7777');
    expect(JSON.stringify(body)).not.toContain('supersecret');
    expect(body.features.triage).toBe(true);
    expect(body.embeddingModel).toBe('text-embedding-3-small');
    expect(body.features.similar).toBe(true);
    // Provider defaults to openai with no custom base URL.
    expect(body.provider).toBe('openai');
    expect(body.baseUrl).toBeNull();
  });

  it('defaults the assistant identity to Tess with no icon', async () => {
    const [org] = await db.insert(orgs).values({ name: 'Org', slug: `o-${crypto.randomUUID()}` }).returning();
    const admin = await loginAs(app, db, { orgId: org.id, role: 'admin' });
    const res = await app.inject({ method: 'GET', url: '/api/v1/ai/settings', headers: { cookie: admin.cookie } });
    expect(res.statusCode).toBe(200);
    expect(res.json().botName).toBe('Tess');
    expect(res.json().botIcon).toBeNull();
  });

  it('persists a personalized bot name + icon and clears the icon on empty string', async () => {
    const [org] = await db.insert(orgs).values({ name: 'Org', slug: `o-${crypto.randomUUID()}` }).returning();
    const admin = await loginAs(app, db, { orgId: org.id, role: 'admin' });
    const put = await app.inject({
      method: 'PUT',
      url: '/api/v1/ai/settings',
      headers: { cookie: admin.cookie, 'content-type': 'application/json' },
      payload: { botName: 'Max', botIcon: '🤖' },
    });
    expect(put.statusCode).toBe(200);
    expect(put.json().botName).toBe('Max');
    expect(put.json().botIcon).toBe('🤖');

    const clear = await app.inject({
      method: 'PUT',
      url: '/api/v1/ai/settings',
      headers: { cookie: admin.cookie, 'content-type': 'application/json' },
      payload: { botIcon: '' },
    });
    expect(clear.statusCode).toBe(200);
    expect(clear.json().botName).toBe('Max'); // untouched
    expect(clear.json().botIcon).toBeNull();
  });

  it('rejects a blank or over-long bot name', async () => {
    const [org] = await db.insert(orgs).values({ name: 'Org', slug: `o-${crypto.randomUUID()}` }).returning();
    const admin = await loginAs(app, db, { orgId: org.id, role: 'admin' });
    const blank = await app.inject({
      method: 'PUT',
      url: '/api/v1/ai/settings',
      headers: { cookie: admin.cookie, 'content-type': 'application/json' },
      payload: { botName: '   ' },
    });
    expect(blank.statusCode).toBe(400);
    const long = await app.inject({
      method: 'PUT',
      url: '/api/v1/ai/settings',
      headers: { cookie: admin.cookie, 'content-type': 'application/json' },
      payload: { botName: 'x'.repeat(25) },
    });
    expect(long.statusCode).toBe(400);
  });

  it('exposes the identity to non-admin roles via /ai/identity without leaking settings', async () => {
    const [org] = await db.insert(orgs).values({ name: 'Org', slug: `o-${crypto.randomUUID()}` }).returning();
    const admin = await loginAs(app, db, { orgId: org.id, role: 'admin' });
    await app.inject({
      method: 'PUT',
      url: '/api/v1/ai/settings',
      headers: { cookie: admin.cookie, 'content-type': 'application/json' },
      payload: { botName: 'Astro', botIcon: '✨', apiKey: 'sk-supersecret-9999' },
    });

    for (const role of ['agent', 'requester'] as const) {
      const user = await loginAs(app, db, { orgId: org.id, role });
      const res = await app.inject({ method: 'GET', url: '/api/v1/ai/identity', headers: { cookie: user.cookie } });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ name: 'Astro', icon: '✨' });
      expect(JSON.stringify(res.json())).not.toContain('supersecret');

      // The full settings stay admin-only.
      const denied = await app.inject({ method: 'GET', url: '/api/v1/ai/settings', headers: { cookie: user.cookie } });
      expect(denied.statusCode).toBe(403);
    }
  });

  it('persists an openai-compatible provider + base URL (BYO/local)', async () => {
    const [org] = await db.insert(orgs).values({ name: 'Org', slug: `o-${crypto.randomUUID()}` }).returning();
    const admin = await loginAs(app, db, { orgId: org.id, role: 'admin' });
    const put = await app.inject({
      method: 'PUT',
      url: '/api/v1/ai/settings',
      headers: { cookie: admin.cookie, 'content-type': 'application/json' },
      payload: { provider: 'openai-compatible', baseUrl: 'http://localhost:11434/v1', model: 'llama3.1' },
    });
    expect(put.statusCode).toBe(200);
    const body = put.json();
    expect(body.provider).toBe('openai-compatible');
    expect(body.baseUrl).toBe('http://localhost:11434/v1');
    expect(body.model).toBe('llama3.1');
  });
});
