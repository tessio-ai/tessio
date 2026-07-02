// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { buildTestApp, resetDb, seedOrgAndSchema, createTestDb, loginAs } from '../testing/harness';

const db = createTestDb();
const { app, teardown } = buildTestApp();

describe('kb revisions', () => {
  beforeEach(async () => { await resetDb(db); });
  afterAll(async () => { await db.$client.end(); await teardown(); });

  it('writes v1 on create, v2 on edit, and lists/views them', async () => {
    const { orgId, schemaId, schemaVersion } = await seedOrgAndSchema(db, 'kb_article');
    const { cookie } = await loginAs(app, db, { orgId, role: 'agent' });
    const created = (await app.inject({ method: 'POST', url: '/api/v1/kb-articles', headers: { cookie }, payload: { schemaId, schemaVersion, title: 'A', status: 'draft', data: { body: 'one' } } })).json();
    await app.inject({ method: 'PATCH', url: `/api/v1/kb-articles/${created.id}`, headers: { cookie }, payload: { data: { body: 'two' } } });
    const list = (await app.inject({ method: 'GET', url: `/api/v1/kb-articles/${created.id}/revisions`, headers: { cookie } })).json();
    expect(list.map((r: { version: number }) => r.version)).toEqual([2, 1]);
    const v1 = list.find((r: { version: number }) => r.version === 1);
    const full = (await app.inject({ method: 'GET', url: `/api/v1/kb-articles/${created.id}/revisions/${v1.id}`, headers: { cookie } })).json();
    expect(full.data.body).toBe('one');
  });

  it('restores a past version as a new version (non-destructive); 404 for a missing revision', async () => {
    const { orgId, schemaId, schemaVersion } = await seedOrgAndSchema(db, 'kb_article');
    const { cookie } = await loginAs(app, db, { orgId, role: 'agent' });
    const created = (await app.inject({ method: 'POST', url: '/api/v1/kb-articles', headers: { cookie }, payload: { schemaId, schemaVersion, title: 'A', status: 'draft', data: { body: 'one' } } })).json();
    await app.inject({ method: 'PATCH', url: `/api/v1/kb-articles/${created.id}`, headers: { cookie }, payload: { data: { body: 'two' } } });
    const list = (await app.inject({ method: 'GET', url: `/api/v1/kb-articles/${created.id}/revisions`, headers: { cookie } })).json();
    const v1 = list.find((r: { version: number }) => r.version === 1);
    const res = await app.inject({ method: 'POST', url: `/api/v1/kb-articles/${created.id}/revisions/${v1.id}/restore`, headers: { cookie } });
    expect(res.statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: `/api/v1/kb-articles/${created.id}`, headers: { cookie } })).json().data.body).toBe('one');
    const after = (await app.inject({ method: 'GET', url: `/api/v1/kb-articles/${created.id}/revisions`, headers: { cookie } })).json();
    expect(after.map((r: { version: number }) => r.version)).toEqual([3, 2, 1]);
    expect((await app.inject({ method: 'GET', url: `/api/v1/kb-articles/${created.id}/revisions/${crypto.randomUUID()}`, headers: { cookie } })).statusCode).toBe(404);
  });
});
