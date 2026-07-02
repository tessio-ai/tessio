// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { buildTestApp, resetDb, seedOrgAndSchema, createTestDb, loginAs } from '../testing/harness';

const db = createTestDb();
const { app, teardown } = buildTestApp();

describe('assets / kb_articles / form_submissions resources', () => {
  beforeEach(async () => {
    await resetDb(db);
  });
  afterAll(async () => {
    await db.$client.end();
    await teardown();
  });

  it('creates and gets an asset', async () => {
    const { orgId, schemaId, schemaVersion } = await seedOrgAndSchema(db, 'asset');
    const { cookie } = await loginAs(app, db, { orgId, role: 'agent' });
    const headers = { cookie };
    const created = (await app.inject({ method: 'POST', url: '/api/v1/assets', headers, payload: { schemaId, schemaVersion, assetTag: 'LAP-1', status: 'in_stock' } })).json();
    expect(created.assetTag).toBe('LAP-1');
    const got = await app.inject({ method: 'GET', url: `/api/v1/assets/${created.id}`, headers });
    expect(got.json().status).toBe('in_stock');
  });

  it('creates a kb article', async () => {
    const { orgId, schemaId, schemaVersion } = await seedOrgAndSchema(db, 'kb_article');
    const { cookie } = await loginAs(app, db, { orgId, role: 'agent' });
    const headers = { cookie };
    const res = await app.inject({ method: 'POST', url: '/api/v1/kb-articles', headers, payload: { schemaId, schemaVersion, title: 'T', slug: 't', status: 'draft' } });
    expect(res.statusCode).toBe(201);
    expect(res.json().slug).toBe('t');
  });

  it('creates a form submission', async () => {
    const { orgId, schemaId, schemaVersion } = await seedOrgAndSchema(db, 'form');
    const { cookie } = await loginAs(app, db, { orgId, role: 'agent' });
    const headers = { cookie };
    const res = await app.inject({ method: 'POST', url: '/api/v1/form-submissions', headers, payload: { schemaId, schemaVersion, formSchemaId: schemaId, source: 'portal' } });
    expect(res.statusCode).toBe(201);
    expect(res.json().source).toBe('portal');
  });
});
