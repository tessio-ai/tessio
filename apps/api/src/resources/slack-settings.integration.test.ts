// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { buildTestApp, resetDb, seedOrgAndSchema, createTestDb, loginAs } from '../testing/harness';

process.env.TESSIO_SECRET_KEY = Buffer.alloc(32, 1).toString('base64');

const db = createTestDb();
const { app, teardown } = buildTestApp();

describe('slack-settings (admin)', () => {
  beforeEach(async () => { await resetDb(db); });
  afterAll(async () => { await db.$client.end(); await teardown(); });

  it('GET lazily creates defaults and never returns the webhook URL', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    const admin = await loginAs(app, db, { orgId, role: 'admin' });
    const res = await app.inject({ method: 'GET', url: '/api/v1/slack-settings', headers: { cookie: admin.cookie } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).not.toHaveProperty('webhookUrlCiphertext');
    expect(body).not.toHaveProperty('webhookUrl');
    expect(body.webhookConfigured).toBe(false);
    expect(body.enabled).toBe(false);
    expect(body.notifyCreated).toBe(true);
    expect(body.notifySlaBreach).toBe(true);
  });

  it('PUT with webhookUrl stores ciphertext; GET returns webhookConfigured:true, no plaintext', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    const admin = await loginAs(app, db, { orgId, role: 'admin' });
    const put = await app.inject({
      method: 'PUT',
      url: '/api/v1/slack-settings',
      headers: { cookie: admin.cookie },
      payload: { webhookUrl: 'https://hooks.slack.com/services/T0/B0/xyz' },
    });
    expect(put.statusCode).toBe(200);
    expect(put.json().webhookConfigured).toBe(true);
    expect(put.json()).not.toHaveProperty('webhookUrl');

    const get = await app.inject({ method: 'GET', url: '/api/v1/slack-settings', headers: { cookie: admin.cookie } });
    expect(get.json().webhookConfigured).toBe(true);
  });

  it('PUT without webhookUrl does not clear an existing ciphertext', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    const admin = await loginAs(app, db, { orgId, role: 'admin' });
    await app.inject({
      method: 'PUT', url: '/api/v1/slack-settings', headers: { cookie: admin.cookie },
      payload: { webhookUrl: 'https://hooks.slack.com/services/T0/B0/xyz' },
    });
    const patch = await app.inject({
      method: 'PUT', url: '/api/v1/slack-settings', headers: { cookie: admin.cookie },
      payload: { notifyCreated: false },
    });
    expect(patch.json().webhookConfigured).toBe(true);
    expect(patch.json().notifyCreated).toBe(false);
  });

  it('PUT rejects a non-https webhook URL (400)', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    const admin = await loginAs(app, db, { orgId, role: 'admin' });
    const res = await app.inject({
      method: 'PUT', url: '/api/v1/slack-settings', headers: { cookie: admin.cookie },
      payload: { webhookUrl: 'http://hooks.slack.com/services/T0/B0/xyz' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().detail).toMatch(/https/i);
  });

  it('PUT rejects enabling without a webhook URL (400), allows it alongside one', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    const admin = await loginAs(app, db, { orgId, role: 'admin' });
    const bad = await app.inject({
      method: 'PUT', url: '/api/v1/slack-settings', headers: { cookie: admin.cookie },
      payload: { enabled: true },
    });
    expect(bad.statusCode).toBe(400);
    expect(bad.json().detail).toMatch(/webhook/i);

    const ok = await app.inject({
      method: 'PUT', url: '/api/v1/slack-settings', headers: { cookie: admin.cookie },
      payload: { enabled: true, webhookUrl: 'https://hooks.slack.com/services/T0/B0/xyz' },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().enabled).toBe(true);
  });

  it('POST /test 400s when no webhook is configured', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    const admin = await loginAs(app, db, { orgId, role: 'admin' });
    const res = await app.inject({ method: 'POST', url: '/api/v1/slack-settings/test', headers: { cookie: admin.cookie } });
    expect(res.statusCode).toBe(400);
    expect(res.json().detail).toMatch(/webhook/i);
  });

  it('forbids an agent (403)', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    const agent = await loginAs(app, db, { orgId, role: 'agent' });
    expect((await app.inject({ method: 'GET', url: '/api/v1/slack-settings', headers: { cookie: agent.cookie } })).statusCode).toBe(403);
    expect((await app.inject({ method: 'PUT', url: '/api/v1/slack-settings', headers: { cookie: agent.cookie }, payload: {} })).statusCode).toBe(403);
  });
});
