// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { buildTestApp, resetDb, seedOrgAndSchema, createTestDb, loginAs } from '../testing/harness';

const db = createTestDb();
const { app, teardown } = buildTestApp();

describe('sla-settings (admin)', () => {
  beforeEach(async () => { await resetDb(db); });
  afterAll(async () => { await db.$client.end(); await teardown(); });

  it('GET lazily creates defaults and returns enabled:false with empty targets', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    const admin = await loginAs(app, db, { orgId, role: 'admin' });
    const res = await app.inject({ method: 'GET', url: '/api/v1/sla-settings', headers: { cookie: admin.cookie } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.enabled).toBe(false);
    expect(body.targets).toBeDefined();
  });

  it('PUT with targets then GET reflects the update', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    const admin = await loginAs(app, db, { orgId, role: 'admin' });
    const put = await app.inject({
      method: 'PUT',
      url: '/api/v1/sla-settings',
      headers: { cookie: admin.cookie },
      payload: { enabled: true, targets: { high: { responseMins: 60, resolutionMins: 240 } } },
    });
    expect(put.statusCode).toBe(200);
    const putBody = put.json();
    expect(putBody.enabled).toBe(true);
    expect(putBody.targets.high.responseMins).toBe(60);
    expect(putBody.targets.high.resolutionMins).toBe(240);

    const get = await app.inject({ method: 'GET', url: '/api/v1/sla-settings', headers: { cookie: admin.cookie } });
    expect(get.statusCode).toBe(200);
    const getBody = get.json();
    expect(getBody.enabled).toBe(true);
    expect(getBody.targets.high.responseMins).toBe(60);
  });

  it('PUT rejects invalid targets (non-positive responseMins)', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    const admin = await loginAs(app, db, { orgId, role: 'admin' });
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/sla-settings',
      headers: { cookie: admin.cookie },
      payload: { targets: { high: { responseMins: 0, resolutionMins: 240 } } },
    });
    expect(res.statusCode).toBe(400);
  });

  it('forbids an agent (403)', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    const agent = await loginAs(app, db, { orgId, role: 'agent' });
    expect((await app.inject({ method: 'GET', url: '/api/v1/sla-settings', headers: { cookie: agent.cookie } })).statusCode).toBe(403);
  });
});
