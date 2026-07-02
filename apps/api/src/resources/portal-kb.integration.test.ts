// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { buildTestApp, resetDb, createTestDb, loginAs } from '../testing/harness';
import { orgs, schemas, kbArticlesRepo } from '@tessio/db';

const db = createTestDb();
const { app, teardown } = buildTestApp();

async function ctx() {
  const [org] = await db.insert(orgs).values({ name: 'Org', slug: `o-${crypto.randomUUID()}` }).returning();
  const [schema] = await db.insert(schemas).values({ orgId: org.id, kind: 'kb_article', key: `a-${crypto.randomUUID()}`, name: 'Article', status: 'published', definition: { fields: [] } }).returning();
  const repo = kbArticlesRepo(db);
  const pub = await repo.create({ orgId: org.id, schemaId: schema.id, schemaVersion: schema.version, title: 'Reset VPN', slug: 'reset-vpn', status: 'published', data: { body: '## Step\n\nDo it.', category: 'How-to', tags: ['vpn'] } });
  const draft = await repo.create({ orgId: org.id, schemaId: schema.id, schemaVersion: schema.version, title: 'Secret draft', slug: 'secret', status: 'draft', data: { body: 'hidden' } });
  const requester = await loginAs(app, db, { orgId: org.id, role: 'requester' });
  return { org, requester, pub, draft };
}

afterAll(async () => { await db.$client.end(); await teardown(); });

describe('public /portal/kb reads', () => {
  beforeEach(async () => { await resetDb(db); });

  it('lists only published articles with summaries', async () => {
    const { requester, pub } = await ctx();
    const res = await app.inject({ method: 'GET', url: '/api/v1/portal/kb', headers: { cookie: requester.cookie } });
    expect(res.statusCode).toBe(200);
    const rows = res.json();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: pub.id, title: 'Reset VPN', category: 'How-to' });
    expect(rows[0].excerpt).toContain('Do it');
  });

  it('reads a published article by id, 404 for a draft or missing', async () => {
    const { requester, pub, draft } = await ctx();
    const ok = await app.inject({ method: 'GET', url: `/api/v1/portal/kb/${pub.id}`, headers: { cookie: requester.cookie } });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().body).toContain('## Step');
    expect((await app.inject({ method: 'GET', url: `/api/v1/portal/kb/${draft.id}`, headers: { cookie: requester.cookie } })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: `/api/v1/portal/kb/${crypto.randomUUID()}`, headers: { cookie: requester.cookie } })).statusCode).toBe(404);
  });
});
