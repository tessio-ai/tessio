// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { auditRepo } from '@tessio/db';
import { buildEnterpriseTestApp, resetDb, seedOrgAndSchema, createTestDb, loginAs, seedUser } from '../testing/harness';

// The audit-log VIEWER is an Enterprise feature; the route only exists when the
// EE plugin is loaded. (The audit WRITER stays in core — see the writer tests
// below, which pass through core login/settings flows regardless of edition.)
process.env.TESSIO_EDITION = 'enterprise';
process.env.TESSIO_SECRET_KEY = Buffer.alloc(32, 1).toString('base64');

const db = createTestDb();
let app: FastifyInstance;
let teardown: () => Promise<void>;

describe('audit-log (admin)', () => {
  beforeAll(async () => { ({ app, teardown } = await buildEnterpriseTestApp()); });
  beforeEach(async () => { await resetDb(db); });
  afterAll(async () => {
    await db.$client.end();
    await teardown();
    delete process.env.TESSIO_EDITION;
  });

  it('GET /audit-log returns items newest-first with nextBefore null when total <= limit', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    const admin = await loginAs(app, db, { orgId, role: 'admin' });

    // Seed two audit rows with different actions
    await auditRepo(db).record({ orgId, actorEmail: 'a@example.com', action: 'user.login', metadata: {} });
    await auditRepo(db).record({ orgId, actorEmail: 'b@example.com', action: 'settings.email.updated', metadata: {} });

    const res = await app.inject({ method: 'GET', url: '/api/v1/audit-log', headers: { cookie: admin.cookie } });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.items).toHaveLength(2);
    // newest-first: settings.email.updated was inserted after user.login
    expect(body.items[0].action).toBe('settings.email.updated');
    expect(body.items[1].action).toBe('user.login');
    expect(body.nextBefore).toBeNull();
  });

  it('GET /audit-log?action=user.login filters to only matching rows', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    const admin = await loginAs(app, db, { orgId, role: 'admin' });

    await auditRepo(db).record({ orgId, actorEmail: 'a@example.com', action: 'user.login', metadata: {} });
    await auditRepo(db).record({ orgId, actorEmail: 'b@example.com', action: 'settings.email.updated', metadata: {} });

    const res = await app.inject({ method: 'GET', url: '/api/v1/audit-log?action=user.login', headers: { cookie: admin.cookie } });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].action).toBe('user.login');
  });

  it('forbids an agent (403)', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    const agent = await loginAs(app, db, { orgId, role: 'agent' });
    const res = await app.inject({ method: 'GET', url: '/api/v1/audit-log', headers: { cookie: agent.cookie } });
    expect(res.statusCode).toBe(403);
  });

  it('POST /auth/login records a user.login audit row', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    const { email, password } = await seedUser(db, { orgId, role: 'admin', password: 'testpass123' });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password },
    });
    expect(res.statusCode).toBe(200);

    // recordAudit is fire-and-forget (void); give the micro-task queue time to flush
    await new Promise((r) => setTimeout(r, 50));

    const rows = await auditRepo(db).list(orgId);
    const loginRow = rows.items.find((r) => r.action === 'user.login');
    expect(loginRow).toBeDefined();
    expect(loginRow!.actorEmail).toBe(email);
    expect(loginRow!.action).toBe('user.login');
  });

  it('PUT /email-settings records settings.email.updated with no password/secret in metadata', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    const admin = await loginAs(app, db, { orgId, role: 'admin' });

    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/email-settings',
      headers: { cookie: admin.cookie },
      payload: {
        enabled: true,
        inboundEnabled: false,
        smtpPassword: 'super-secret-password',
        imapPassword: 'another-secret',
        acceptNewSenders: true,
      },
    });
    expect(res.statusCode).toBe(200);

    // recordAudit is fire-and-forget (void); give the micro-task queue time to flush
    await new Promise((r) => setTimeout(r, 50));

    const rows = await auditRepo(db).list(orgId);
    const settingsRow = rows.items.find((r) => r.action === 'settings.email.updated');
    expect(settingsRow).toBeDefined();

    // Only allow-listed keys should appear in metadata — never secret/password fields
    const meta = settingsRow!.metadata as Record<string, unknown>;
    expect(meta).toHaveProperty('enabled', true);
    expect(meta).toHaveProperty('inboundEnabled', false);
    expect(meta).toHaveProperty('acceptNewSenders', true);
    expect(meta).not.toHaveProperty('smtpPassword');
    expect(meta).not.toHaveProperty('imapPassword');
    expect(meta).not.toHaveProperty('clientSecret');
    expect(meta).not.toHaveProperty('apiKey');
  });
});
