// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildTestApp, createTestDb, resetDb, loginAs } from '../testing/harness';
import { orgs, aiSettingsRepo } from '@tessio/db';

process.env.TESSIO_SECRET_KEY = Buffer.alloc(32, 1).toString('base64');
const db = createTestDb();
const { app, teardown } = buildTestApp();

afterAll(async () => { await db.$client.end(); await teardown(); });
beforeAll(async () => { await app.ready(); });
beforeEach(async () => { await resetDb(db); });

async function org() {
  const [o] = await db.insert(orgs).values({ name: 'Org', slug: `o-${crypto.randomUUID()}` }).returning();
  return o.id;
}

describe('POST /ai/ask gating', () => {
  it('409 when ask is disabled', async () => {
    const orgId = await org();
    const admin = await loginAs(app, db, { orgId, role: 'admin' });
    const res = await app.inject({ method: 'POST', url: '/api/v1/ai/ask', headers: { cookie: admin.cookie, 'content-type': 'application/json' }, payload: { query: 'unassigned tickets' } });
    expect(res.statusCode).toBe(409);
  });

  it('409 (not configured) once enabled+ask but no model', async () => {
    const orgId = await org();
    await aiSettingsRepo(db).getOrCreate(orgId);
    await aiSettingsRepo(db).update(orgId, { enabled: true, features: { summary: false, draft: false, triage: false, similar: false, ask: true } });
    const admin = await loginAs(app, db, { orgId, role: 'admin' });
    const res = await app.inject({ method: 'POST', url: '/api/v1/ai/ask', headers: { cookie: admin.cookie, 'content-type': 'application/json' }, payload: { query: 'x' } });
    // enabled + ask on, but model defaults to '' → "no model configured" 409
    expect(res.statusCode).toBe(409);
  });

  it('409 (no api key) when enabled+ask+model but no key stored', async () => {
    const orgId = await org();
    await aiSettingsRepo(db).getOrCreate(orgId);
    await aiSettingsRepo(db).update(orgId, { enabled: true, model: 'gpt-4o-mini', features: { summary: false, draft: false, triage: false, similar: false, ask: true } });
    const admin = await loginAs(app, db, { orgId, role: 'admin' });
    const res = await app.inject({ method: 'POST', url: '/api/v1/ai/ask', headers: { cookie: admin.cookie, 'content-type': 'application/json' }, payload: { query: 'unassigned tickets' } });
    expect(res.statusCode).toBe(409);
  });
});
