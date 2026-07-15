// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Password reset, end to end: the self-serve emailed flow (forgot → token →
 * reset → old sessions revoked) and the admin-initiated reset. The email queue
 * is the capturing stub, so tests read the reset link straight out of the
 * "sent" email like a user would.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { buildTestApp, resetDb, seedOrgAndSchema, createTestDb, loginAs, seedUser, stubWorkflowProducers } from '../testing/harness';
import { passwordResetsRepo } from '@tessio/db';

process.env.TESSIO_SECRET_KEY = Buffer.alloc(32, 1).toString('base64');
process.env.TESSIO_SITE_URL = 'https://desk.example.com';

const db = createTestDb();
const producers = stubWorkflowProducers();
const { app, teardown } = buildTestApp({ workflowProducers: producers });

const tokenFromEmail = (text: string): string => {
  const m = text.match(/token=([A-Za-z0-9_-]+)/);
  if (!m) throw new Error(`no reset link in email:\n${text}`);
  return m[1];
};

describe('password reset', () => {
  beforeAll(async () => {
    await app.ready();
  });
  beforeEach(async () => {
    await resetDb(db);
    producers.sentEmails.length = 0;
  });
  afterAll(async () => {
    await db.$client.end();
    await teardown();
  });

  it('forgot → emailed link → reset → login with the new password; old sessions die', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    const { user, email } = await seedUser(db, { orgId, role: 'agent', password: 'old-password-1!' });
    const oldSession = await loginAs(app, db, { orgId, role: 'agent', userId: user.id });

    const forgot = await app.inject({ method: 'POST', url: '/api/v1/auth/forgot-password', payload: { email } });
    expect(forgot.statusCode).toBe(204);
    expect(producers.sentEmails).toHaveLength(1);
    expect(producers.sentEmails[0].to).toBe(email);
    expect(producers.sentEmails[0].text).toContain('https://desk.example.com/#/reset-password?token=');

    const token = tokenFromEmail(producers.sentEmails[0].text);
    const reset = await app.inject({ method: 'POST', url: '/api/v1/auth/reset-password', payload: { token, password: 'brand-new-pass-9!' } });
    expect(reset.statusCode).toBe(204);

    // Old password dead, new one works.
    const oldLogin = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email, password: 'old-password-1!' } });
    expect(oldLogin.statusCode).toBe(401);
    const newLogin = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email, password: 'brand-new-pass-9!' } });
    expect(newLogin.statusCode).toBe(200);

    // The pre-reset session was revoked.
    const me = await app.inject({ method: 'GET', url: '/api/v1/auth/me', headers: { cookie: oldSession.cookie } });
    expect(me.statusCode).toBe(401);
  });

  it('answers 204 for unknown emails and sends nothing (no account enumeration)', async () => {
    await seedOrgAndSchema(db, 'ticket');
    const res = await app.inject({ method: 'POST', url: '/api/v1/auth/forgot-password', payload: { email: 'nobody@nowhere.test' } });
    expect(res.statusCode).toBe(204);
    expect(producers.sentEmails).toHaveLength(0);
  });

  it('does not send reset links to disabled accounts', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    const admin = await loginAs(app, db, { orgId, role: 'admin' });
    const { user, email } = await seedUser(db, { orgId, role: 'agent' });
    await app.inject({ method: 'PATCH', url: `/api/v1/users/${user.id}`, headers: { cookie: admin.cookie }, payload: { status: 'disabled' } });

    const res = await app.inject({ method: 'POST', url: '/api/v1/auth/forgot-password', payload: { email } });
    expect(res.statusCode).toBe(204);
    expect(producers.sentEmails).toHaveLength(0);
  });

  it('a token is single-use, and a new request invalidates the previous link', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    const { email } = await seedUser(db, { orgId, role: 'agent' });

    await app.inject({ method: 'POST', url: '/api/v1/auth/forgot-password', payload: { email } });
    await app.inject({ method: 'POST', url: '/api/v1/auth/forgot-password', payload: { email } });
    const [first, second] = producers.sentEmails.map((m) => tokenFromEmail(m.text));

    // The older link died when the newer one was minted.
    const stale = await app.inject({ method: 'POST', url: '/api/v1/auth/reset-password', payload: { token: first, password: 'whatever-123!' } });
    expect(stale.statusCode).toBe(400);

    const ok = await app.inject({ method: 'POST', url: '/api/v1/auth/reset-password', payload: { token: second, password: 'whatever-123!' } });
    expect(ok.statusCode).toBe(204);
    // …and works exactly once.
    const replay = await app.inject({ method: 'POST', url: '/api/v1/auth/reset-password', payload: { token: second, password: 'another-456!' } });
    expect(replay.statusCode).toBe(400);
  });

  it('rejects expired tokens', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    const { user } = await seedUser(db, { orgId, role: 'agent' });
    const { token } = await passwordResetsRepo(db).create({ orgId, userId: user.id, ttlMs: -1000 });
    const res = await app.inject({ method: 'POST', url: '/api/v1/auth/reset-password', payload: { token, password: 'whatever-123!' } });
    expect(res.statusCode).toBe(400);
  });

  it('rejects garbage tokens and short passwords', async () => {
    await seedOrgAndSchema(db, 'ticket');
    const bad = await app.inject({ method: 'POST', url: '/api/v1/auth/reset-password', payload: { token: 'not-a-token', password: 'long-enough-1!' } });
    expect(bad.statusCode).toBe(400);
    const short = await app.inject({ method: 'POST', url: '/api/v1/auth/reset-password', payload: { token: 'x', password: 'short' } });
    expect(short.statusCode).toBe(400);
  });

  it('admin reset returns a working one-time password and revokes sessions; admin-only', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    const admin = await loginAs(app, db, { orgId, role: 'admin' });
    const { user, email } = await seedUser(db, { orgId, role: 'agent', password: 'old-password-1!' });
    const targetSession = await loginAs(app, db, { orgId, role: 'agent', userId: user.id });

    const res = await app.inject({ method: 'POST', url: `/api/v1/users/${user.id}/reset-password`, headers: { cookie: admin.cookie }, payload: {} });
    expect(res.statusCode).toBe(200);
    const { password } = res.json();
    expect(password.length).toBeGreaterThanOrEqual(12);

    const oldLogin = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email, password: 'old-password-1!' } });
    expect(oldLogin.statusCode).toBe(401);
    const newLogin = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email, password } });
    expect(newLogin.statusCode).toBe(200);
    const me = await app.inject({ method: 'GET', url: '/api/v1/auth/me', headers: { cookie: targetSession.cookie } });
    expect(me.statusCode).toBe(401);

    // Agents cannot reach the admin reset endpoint.
    const agent = await loginAs(app, db, { orgId, role: 'agent' });
    const denied = await app.inject({ method: 'POST', url: `/api/v1/users/${user.id}/reset-password`, headers: { cookie: agent.cookie }, payload: {} });
    expect(denied.statusCode).toBe(403);
  });
});
