// SPDX-License-Identifier: LicenseRef-Tessio-Commercial

/**
 * SSO routes integration tests.
 *
 * Uses an injected fake OidcVerifier so no real OIDC server is needed.
 * The fake captures the `state` passed to authUrl so tests can replay it
 * in the callback's `?state=` query parameter.
 *
 * Builds a minimal Fastify app and registers the SSO routes directly with a
 * fake verifier and an injected enterprise context (so ee never imports core).
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { createTestDb, resetDb } from '@tessio/db/testing';
import { orgs, usersRepo, ssoSettingsRepo, hashPassword } from '@tessio/db';
import { eq } from 'drizzle-orm';
import { encryptSecret } from '@tessio/ai';
import type { EnterpriseContext } from '@tessio/entitlements';
import Fastify, { type FastifyReply } from 'fastify';
import cookie from '@fastify/cookie';
import { registerSsoRoutes } from './routes';
import type { OidcVerifier, OidcClaims, OidcConfig } from './oidc';

// Provide a fixed 32-byte key for encryption/decryption in tests.
const TEST_KEY = Buffer.alloc(32, 42).toString('base64');
process.env.TESSIO_SECRET_KEY = TEST_KEY;

const db = createTestDb();

// ─── Fake verifier factory ───────────────────────────────────────────────────

/** Captured state from the most recent authUrl() call. */
let capturedState: string | null = null;
/** Claimed identity the fake will assert on verify(). */
let fakeVerifyClaims: OidcClaims | null = { email: 'alice@acme.com', emailVerified: true, name: 'Alice' };
/** Whether fake.verify should throw. */
let fakeVerifyThrow = false;

function makeFakeVerifier(_cfg: OidcConfig): OidcVerifier {
  void _cfg; // intentionally unused — fake doesn't need the real config
  return {
    async authUrl({ state }) {
      capturedState = state;
      return 'https://idp.example/authorize?state=' + state;
    },
    async verify() {
      if (fakeVerifyThrow) throw new Error('fake: id token validation failed');
      if (!fakeVerifyClaims) throw new Error('fake: no claims configured');
      return fakeVerifyClaims;
    },
  };
}

// ─── Injected core context (these live in core; here we provide test doubles) ──

const SESSION_COOKIE = 'tessio_session';
function setSessionCookie(reply: FastifyReply, id: string): void {
  reply.setCookie(SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    signed: true,
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
  });
}

const ctx: EnterpriseContext = {
  db,
  setSessionCookie,
  recordAudit: async () => {},
  safeMeta: (obj, allowed) => {
    const out: Record<string, unknown> = {};
    for (const k of allowed) if (obj[k] !== undefined) out[k] = obj[k];
    return out;
  },
};

// ─── Build a minimal Fastify app wired to the test DB + fake SSO ─────────────

function buildSsoTestApp() {
  const app = Fastify({ logger: false, trustProxy: true });
  app.register(cookie, { secret: 'test-insecure-secret-for-sso-cookie-signing-only' });
  app.register(
    async (v1) => {
      registerSsoRoutes(v1, ctx, { makeVerifier: makeFakeVerifier });
    },
    { prefix: '/api/v1' },
  );
  return app;
}

const ssoApp = buildSsoTestApp();

afterAll(async () => {
  await db.$client.end();
  await ssoApp.close();
});

// ─── Seed helpers ─────────────────────────────────────────────────────────────

async function seedSso(overrides: Partial<{ autoCreateUsers: boolean; allowedDomain: string | null }> = {}) {
  await ssoSettingsRepo(db).get();
  await ssoSettingsRepo(db).update({
    enabled: true,
    issuer: 'https://idp.example',
    clientId: 'test-client',
    clientSecretCiphertext: encryptSecret('secret', TEST_KEY),
    buttonLabel: 'Login with IdP',
    autoCreateUsers: overrides.autoCreateUsers ?? false,
    allowedDomain: overrides.allowedDomain ?? null,
  });
}

async function seedAlice(opts: { orgSlug?: string } = {}) {
  const slug = opts.orgSlug ?? `o-${crypto.randomUUID()}`;
  const [org] = await db.insert(orgs).values({ name: 'Acme', slug }).returning();
  const user = await usersRepo(db).create({
    orgId: org.id,
    email: 'alice@acme.com',
    name: 'Alice',
    role: 'requester',
    passwordHash: await hashPassword('pw'),
  });
  return { org, user };
}

async function seedDefaultOrg() {
  const existing = await db.select().from(orgs).where(eq(orgs.slug, 'default'));
  if (existing[0]) return existing[0];
  const [org] = await db.insert(orgs).values({ name: 'Acme Corp', slug: 'default' }).returning();
  return org;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SSO routes', () => {
  beforeEach(async () => {
    await resetDb(db);
    capturedState = null;
    fakeVerifyClaims = { email: 'alice@acme.com', emailVerified: true, name: 'Alice' };
    fakeVerifyThrow = false;
  });

  it('GET /auth/sso/info returns enabled + buttonLabel when configured', async () => {
    await seedSso();
    const res = await ssoApp.inject({ method: 'GET', url: '/api/v1/auth/sso/info' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.enabled).toBe(true);
    expect(body.buttonLabel).toBe('Login with IdP');
    expect(JSON.stringify(body)).not.toContain('secret');
    expect(JSON.stringify(body)).not.toContain('clientSecret');
    expect(JSON.stringify(body)).not.toContain('Ciphertext');
  });

  it('GET /auth/sso/info returns enabled=false when not configured', async () => {
    const res = await ssoApp.inject({ method: 'GET', url: '/api/v1/auth/sso/info' });
    expect(res.statusCode).toBe(200);
    expect(res.json().enabled).toBe(false);
  });

  it('GET /auth/sso/start redirects to IdP and sets tessio_sso cookie', async () => {
    await seedSso();
    const res = await ssoApp.inject({ method: 'GET', url: '/api/v1/auth/sso/start' });
    expect(res.statusCode).toBe(302);
    const location = res.headers.location as string;
    expect(location).toMatch(/^https:\/\/idp\.example\/authorize/);

    const setCookie = res.headers['set-cookie'] as string | string[];
    const cookieStr = Array.isArray(setCookie) ? setCookie.join('; ') : setCookie;
    expect(cookieStr).toMatch(/tessio_sso=/);
    expect(cookieStr).toMatch(/HttpOnly/i);
  });

  it('GET /auth/sso/start redirects to / when SSO not configured', async () => {
    const res = await ssoApp.inject({ method: 'GET', url: '/api/v1/auth/sso/start' });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('/');
  });

  async function doCallback(overrides: { state?: string; cookie?: string } = {}) {
    await ssoApp.ready();
    const startRes = await ssoApp.inject({ method: 'GET', url: '/api/v1/auth/sso/start' });
    const rawSetCookie = startRes.headers['set-cookie'];
    const firstCookieHeader = Array.isArray(rawSetCookie) ? rawSetCookie[0] : rawSetCookie;
    const cookieValue = firstCookieHeader ? firstCookieHeader.split(';')[0] : '';

    const state = overrides.state ?? capturedState ?? 'bad';
    const cookieHeader = overrides.cookie ?? cookieValue;

    return ssoApp.inject({
      method: 'GET',
      url: `/api/v1/auth/sso/callback?code=authcode&state=${encodeURIComponent(state)}`,
      headers: { cookie: cookieHeader },
    });
  }

  it('callback with valid state+cookie logs in and sets session cookie', async () => {
    await seedSso();
    await seedAlice();
    const res = await doCallback();
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('/');
    const setCookie = res.headers['set-cookie'] as string | string[];
    const cookieStr = Array.isArray(setCookie) ? setCookie.join('; ') : setCookie;
    expect(cookieStr).toMatch(/tessio_session=/);
  });

  it('callback with wrong state returns sso_error=bad_state', async () => {
    await seedSso();
    await seedAlice();
    const res = await doCallback({ state: 'totally-wrong-state' });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toMatch(/sso_error=bad_state/);
  });

  it('callback with no cookie returns sso_error=bad_state', async () => {
    await seedSso();
    const res = await ssoApp.inject({
      method: 'GET',
      url: '/api/v1/auth/sso/callback?code=x&state=y',
    });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toMatch(/sso_error=bad_state/);
  });

  it('callback where verify throws returns sso_error=auth_failed', async () => {
    await seedSso();
    await seedAlice();
    fakeVerifyThrow = true;
    const res = await doCallback();
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toMatch(/sso_error=auth_failed/);
  });

  it('callback with unknown email + autoCreate=false returns sso_error=no_account', async () => {
    await seedSso({ autoCreateUsers: false });
    fakeVerifyClaims = { email: 'unknown@acme.com', emailVerified: true, name: 'Unknown' };
    const res = await doCallback();
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toMatch(/sso_error=no_account/);
  });

  it('callback with unknown email + autoCreate=true provisions user and logs in', async () => {
    await seedSso({ autoCreateUsers: true });
    await seedDefaultOrg();
    fakeVerifyClaims = { email: 'newuser@acme.com', emailVerified: true, name: 'New User' };
    const res = await doCallback();
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('/');
    const setCookie = res.headers['set-cookie'] as string | string[];
    const cookieStr = Array.isArray(setCookie) ? setCookie.join('; ') : setCookie;
    expect(cookieStr).toMatch(/tessio_session=/);

    const created = await usersRepo(db).findByEmailGlobal('newuser@acme.com');
    expect(created).toBeDefined();
    expect(created!.role).toBe('requester');
    expect(created!.passwordHash).toMatch(/^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
  });

  it('callback with unverified email returns sso_error=unverified', async () => {
    await seedSso();
    await seedAlice();
    fakeVerifyClaims = { email: 'alice@acme.com', emailVerified: false, name: 'Alice' };
    const res = await doCallback();
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toMatch(/sso_error=unverified/);
  });
});
