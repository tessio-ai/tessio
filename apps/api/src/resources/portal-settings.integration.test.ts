// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { buildTestApp, resetDb, seedOrgAndSchema, createTestDb, loginAs } from '../testing/harness';

const db = createTestDb();
const { app, teardown } = buildTestApp();

describe('portal-settings (admin)', () => {
  beforeEach(async () => { await resetDb(db); });
  afterAll(async () => { await db.$client.end(); await teardown(); });

  it('GET lazily creates defaults; PATCH updates', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    const admin = await loginAs(app, db, { orgId, role: 'admin' });
    const get = await app.inject({ method: 'GET', url: '/api/v1/portal-settings', headers: { cookie: admin.cookie } });
    expect(get.statusCode).toBe(200);
    expect(get.json().heroHeadline).toBe('How can we help?');

    const patch = await app.inject({ method: 'PATCH', url: '/api/v1/portal-settings', headers: { cookie: admin.cookie },
      payload: { brandName: 'Acme', categories: [{ key: 'IT', label: 'IT', icon: 'laptop', color: '#2563eb', order: 0, visible: true }] } });
    expect(patch.json().brandName).toBe('Acme');
    expect(patch.json().categories[0].key).toBe('IT');
  });

  it('PATCH persists hero + catalog', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    const admin = await loginAs(app, db, { orgId, role: 'admin' });
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/portal-settings',
      headers: { cookie: admin.cookie },
      payload: {
        hero: { preset: 'editorial', eyebrow: 'Help Center', pills: [], showSearch: true },
        catalog: { sectionStyle: 'plain', cardStyle: 'compact', columns: 2 },
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.hero.preset).toBe('editorial');
    expect(body.catalog.columns).toBe(2);
  });

  it('forbids an agent (403)', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    const agent = await loginAs(app, db, { orgId, role: 'agent' });
    expect((await app.inject({ method: 'GET', url: '/api/v1/portal-settings', headers: { cookie: agent.cookie } })).statusCode).toBe(403);
  });
});
