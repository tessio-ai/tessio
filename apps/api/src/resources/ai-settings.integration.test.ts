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
