// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildEnterpriseTestApp, resetDb, seedOrgAndSchema, createTestDb, loginAs } from '../testing/harness';

// SSO is an Enterprise feature: the route only exists when the EE plugin is loaded.
process.env.TESSIO_EDITION = 'enterprise';
process.env.TESSIO_SECRET_KEY = Buffer.alloc(32, 1).toString('base64');

const db = createTestDb();
let app: FastifyInstance;
let teardown: () => Promise<void>;

describe('sso-settings (admin)', () => {
  beforeAll(async () => { ({ app, teardown } = await buildEnterpriseTestApp()); });
  beforeEach(async () => { await resetDb(db); });
  afterAll(async () => {
    await db.$client.end();
    await teardown();
    delete process.env.TESSIO_EDITION;
  });

  it('GET returns defaults with clientSecretConfigured:false and a redirectUri', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    const admin = await loginAs(app, db, { orgId, role: 'admin' });
    const res = await app.inject({ method: 'GET', url: '/api/v1/sso-settings', headers: { cookie: admin.cookie } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.enabled).toBe(false);
    expect(body.clientSecretConfigured).toBe(false);
    expect(body).not.toHaveProperty('clientSecretCiphertext');
    expect(body).not.toHaveProperty('clientSecret');
    expect(body.redirectUri).toMatch(/\/api\/v1\/auth\/sso\/callback$/);
  });

  it('PUT with clientSecret stores ciphertext; GET returns clientSecretConfigured:true, no plaintext', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    const admin = await loginAs(app, db, { orgId, role: 'admin' });
    const put = await app.inject({
      method: 'PUT',
      url: '/api/v1/sso-settings',
      headers: { cookie: admin.cookie },
      payload: {
        enabled: true,
        issuer: 'https://accounts.google.com',
        clientId: 'cid',
        clientSecret: 'shh',
        buttonLabel: 'Sign in with Google',
      },
    });
    expect(put.statusCode).toBe(200);
    const putBody = put.json();
    expect(putBody.enabled).toBe(true);
    expect(putBody.issuer).toBe('https://accounts.google.com');
    expect(putBody.clientId).toBe('cid');
    expect(putBody.buttonLabel).toBe('Sign in with Google');
    expect(putBody.clientSecretConfigured).toBe(true);
    expect(putBody).not.toHaveProperty('clientSecretCiphertext');
    expect(putBody).not.toHaveProperty('clientSecret');
    expect(putBody.redirectUri).toMatch(/\/api\/v1\/auth\/sso\/callback$/);

    const get = await app.inject({ method: 'GET', url: '/api/v1/sso-settings', headers: { cookie: admin.cookie } });
    expect(get.statusCode).toBe(200);
    const getBody = get.json();
    expect(getBody.enabled).toBe(true);
    expect(getBody.issuer).toBe('https://accounts.google.com');
    expect(getBody.clientId).toBe('cid');
    expect(getBody.buttonLabel).toBe('Sign in with Google');
    expect(getBody.clientSecretConfigured).toBe(true);
    expect(getBody).not.toHaveProperty('clientSecretCiphertext');
    expect(getBody).not.toHaveProperty('clientSecret');
    expect(getBody.redirectUri).toMatch(/\/api\/v1\/auth\/sso\/callback$/);
  });

  it('PUT without clientSecret does not clear an existing ciphertext', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    const admin = await loginAs(app, db, { orgId, role: 'admin' });
    // First PUT sets the secret
    await app.inject({
      method: 'PUT',
      url: '/api/v1/sso-settings',
      headers: { cookie: admin.cookie },
      payload: { clientSecret: 'shh' },
    });
    // Second PUT without clientSecret should keep ciphertext intact
    const patch = await app.inject({
      method: 'PUT',
      url: '/api/v1/sso-settings',
      headers: { cookie: admin.cookie },
      payload: { buttonLabel: 'Updated label' },
    });
    expect(patch.statusCode).toBe(200);
    expect(patch.json().clientSecretConfigured).toBe(true);
  });

  it('forbids an agent PUT (403)', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    const agent = await loginAs(app, db, { orgId, role: 'agent' });
    expect(
      (await app.inject({ method: 'PUT', url: '/api/v1/sso-settings', headers: { cookie: agent.cookie }, payload: {} })).statusCode,
    ).toBe(403);
  });

  it('forbids an agent GET (403)', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    const agent = await loginAs(app, db, { orgId, role: 'agent' });
    expect(
      (await app.inject({ method: 'GET', url: '/api/v1/sso-settings', headers: { cookie: agent.cookie } })).statusCode,
    ).toBe(403);
  });
});
