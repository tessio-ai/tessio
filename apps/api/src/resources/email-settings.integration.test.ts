// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { buildTestApp, resetDb, seedOrgAndSchema, createTestDb, loginAs } from '../testing/harness';

process.env.TESSIO_SECRET_KEY = Buffer.alloc(32, 1).toString('base64');

const db = createTestDb();
const { app, teardown } = buildTestApp();

describe('email-settings (admin)', () => {
  beforeEach(async () => { await resetDb(db); });
  afterAll(async () => { await db.$client.end(); await teardown(); });

  it('GET lazily creates defaults and returns no password fields', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    const admin = await loginAs(app, db, { orgId, role: 'admin' });
    const res = await app.inject({ method: 'GET', url: '/api/v1/email-settings', headers: { cookie: admin.cookie } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).not.toHaveProperty('smtpPasswordCiphertext');
    expect(body).not.toHaveProperty('imapPasswordCiphertext');
    expect(body.smtpConfigured).toBe(false);
    expect(body.imapConfigured).toBe(false);
    expect(body.enabled).toBe(false);
  });

  it('PUT with smtpPassword stores ciphertext; GET returns smtpConfigured:true, no plaintext', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    const admin = await loginAs(app, db, { orgId, role: 'admin' });
    const put = await app.inject({
      method: 'PUT',
      url: '/api/v1/email-settings',
      headers: { cookie: admin.cookie },
      payload: { smtpHost: 'smtp.example.com', smtpPort: 587, smtpUser: 'user@example.com', smtpPassword: 'secret' },
    });
    expect(put.statusCode).toBe(200);
    const putBody = put.json();
    expect(putBody.smtpConfigured).toBe(true);
    expect(putBody).not.toHaveProperty('smtpPasswordCiphertext');
    expect(putBody).not.toHaveProperty('smtpPassword');

    const get = await app.inject({ method: 'GET', url: '/api/v1/email-settings', headers: { cookie: admin.cookie } });
    expect(get.statusCode).toBe(200);
    const getBody = get.json();
    expect(getBody.smtpConfigured).toBe(true);
    expect(getBody).not.toHaveProperty('smtpPasswordCiphertext');
  });

  it('PUT without smtpPassword does not clear an existing ciphertext', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    const admin = await loginAs(app, db, { orgId, role: 'admin' });
    await app.inject({
      method: 'PUT', url: '/api/v1/email-settings', headers: { cookie: admin.cookie },
      payload: { smtpPassword: 'secret' },
    });
    const patch = await app.inject({
      method: 'PUT', url: '/api/v1/email-settings', headers: { cookie: admin.cookie },
      payload: { smtpHost: 'smtp.example.com' },
    });
    expect(patch.json().smtpConfigured).toBe(true);
  });

  it('forbids an agent (403)', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    const agent = await loginAs(app, db, { orgId, role: 'agent' });
    expect((await app.inject({ method: 'GET', url: '/api/v1/email-settings', headers: { cookie: agent.cookie } })).statusCode).toBe(403);
  });

  it('PUT rejects enabling inbound without a defaultSchemaId (400)', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    const admin = await loginAs(app, db, { orgId, role: 'admin' });
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/email-settings',
      headers: { cookie: admin.cookie },
      payload: { inboundEnabled: true },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().detail).toMatch(/ticket type/i);
  });

  it('PUT allows enabling inbound when defaultSchemaId is provided', async () => {
    const { orgId, schemaId } = await seedOrgAndSchema(db, 'ticket');
    const admin = await loginAs(app, db, { orgId, role: 'admin' });
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/email-settings',
      headers: { cookie: admin.cookie },
      payload: { inboundEnabled: true, defaultSchemaId: schemaId },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().inboundEnabled).toBe(true);
    expect(res.json().defaultSchemaId).toBe(schemaId);
  });

  it('PUT rejects enabling inbound when only a prior defaultSchemaId exists but is being cleared', async () => {
    const { orgId, schemaId } = await seedOrgAndSchema(db, 'ticket');
    const admin = await loginAs(app, db, { orgId, role: 'admin' });
    // First set a schema
    await app.inject({
      method: 'PUT',
      url: '/api/v1/email-settings',
      headers: { cookie: admin.cookie },
      payload: { defaultSchemaId: schemaId },
    });
    // Now try to enable inbound while clearing the schema in the same call
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/email-settings',
      headers: { cookie: admin.cookie },
      payload: { inboundEnabled: true, defaultSchemaId: null },
    });
    expect(res.statusCode).toBe(400);
  });
});
