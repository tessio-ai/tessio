// SPDX-License-Identifier: LicenseRef-Tessio-Commercial

import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { ssoSettingsRepo, usersRepo, sessionsRepo, orgs } from '@tessio/db';
import { decryptSecret } from '@tessio/ai';
import type { EnterpriseContext } from '@tessio/entitlements';
import { resolveSsoUser } from './resolve';
import { createOidcVerifier, type OidcConfig, type OidcVerifier } from './oidc';

const SSO_COOKIE = 'tessio_sso';
const DEFAULT_ORG_SLUG = 'default';

interface SsoDeps {
  makeVerifier?: (cfg: OidcConfig) => OidcVerifier;
}

interface SsoCookiePayload {
  state: string;
  nonce: string;
  codeVerifier: string;
}

/**
 * Public (pre-session) OIDC SSO routes. Core capabilities (db, session cookie,
 * audit writer) are injected via `ctx` so this enterprise module never imports
 * from `apps/api`.
 */
export function registerSsoRoutes(app: FastifyInstance, ctx: EnterpriseContext, deps?: SsoDeps): void {
  const { db, setSessionCookie, recordAudit } = ctx;
  const makeVerifier = deps?.makeVerifier ?? createOidcVerifier;

  // Helper: resolve redirectUri from env
  const getRedirectUri = () =>
    (process.env.TESSIO_SITE_URL ?? 'http://localhost') + '/api/v1/auth/sso/callback';

  // Helper: check if SSO is fully configured
  async function getSsoState() {
    const s = await ssoSettingsRepo(db).get();
    const configured =
      s.enabled && !!s.issuer && !!s.clientId && !!s.clientSecretCiphertext;
    return { s, configured };
  }

  // GET /auth/sso/info
  app.get('/auth/sso/info', async () => {
    const { s, configured } = await getSsoState();
    return { enabled: configured, buttonLabel: s.buttonLabel };
  });

  // GET /auth/sso/start
  app.get(
    '/auth/sso/start',
    { config: { rateLimit: { max: 20, timeWindow: '5 minutes' } } },
    async (req, reply) => {
      const { s, configured } = await getSsoState();

      if (!configured) {
        return reply.redirect('/');
      }

      const state = randomBytes(32).toString('base64url');
      const nonce = randomBytes(32).toString('base64url');
      // PKCE verifier: 32 random bytes → 43-char base64url string (within 43–128 requirement)
      const codeVerifier = randomBytes(32).toString('base64url');

      const payload: SsoCookiePayload = { state, nonce, codeVerifier };
      reply.setCookie(SSO_COOKIE, JSON.stringify(payload), {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        signed: true,
        path: '/',
        maxAge: 600,
      });

      const redirectUri = getRedirectUri();
      const cfg: OidcConfig = {
        issuer: s.issuer!,
        clientId: s.clientId!,
        clientSecret: decryptSecret(s.clientSecretCiphertext!, process.env.TESSIO_SECRET_KEY!),
        redirectUri,
      };

      const url = await makeVerifier(cfg).authUrl({ state, nonce, codeVerifier });
      return reply.redirect(url);
    },
  );

  // GET /auth/sso/callback
  app.get(
    '/auth/sso/callback',
    { config: { rateLimit: { max: 20, timeWindow: '5 minutes' } } },
    async (req, reply) => {
      // Consume the temp cookie immediately regardless of outcome
      const raw = (req.cookies as Record<string, string | undefined>)[SSO_COOKIE];
      reply.clearCookie(SSO_COOKIE, { path: '/' });

      const unsigned = raw ? req.unsignCookie(raw) : { valid: false as const, value: null };
      if (!unsigned.valid || !unsigned.value) {
        return reply.redirect('/#/login?sso_error=bad_state');
      }

      let payload: SsoCookiePayload;
      try {
        payload = JSON.parse(unsigned.value) as SsoCookiePayload;
      } catch {
        return reply.redirect('/#/login?sso_error=bad_state');
      }

      const { state, nonce, codeVerifier } = payload;

      // Validate state from query matches what we issued
      const queryState = (req.query as Record<string, string | undefined>).state;
      if (!queryState || queryState !== state) {
        return reply.redirect('/#/login?sso_error=bad_state');
      }

      const { s, configured } = await getSsoState();
      if (!configured) {
        return reply.redirect('/#/login?sso_error=auth_failed');
      }

      const redirectUri = getRedirectUri();
      const cfg: OidcConfig = {
        issuer: s.issuer!,
        clientId: s.clientId!,
        clientSecret: decryptSecret(s.clientSecretCiphertext!, process.env.TESSIO_SECRET_KEY!),
        redirectUri,
      };

      // Build the full callback URL for openid-client (it needs the query params)
      // We use redirectUri as base and append the current request query string.
      const requestUrl = req.url; // e.g. /api/v1/auth/sso/callback?code=...&state=...
      const queryString = requestUrl.includes('?') ? requestUrl.slice(requestUrl.indexOf('?')) : '';
      const callbackUrl = redirectUri + queryString;

      let claims: Awaited<ReturnType<ReturnType<typeof createOidcVerifier>['verify']>>;
      try {
        claims = await makeVerifier(cfg).verify({ callbackUrl, state, nonce, codeVerifier });
      } catch (err) {
        req.log?.error?.({ err }, 'sso verify failed');
        return reply.redirect('/#/login?sso_error=auth_failed');
      }

      const existing = await usersRepo(db).findByEmailGlobal(claims.email);
      const res = resolveSsoUser({
        email: claims.email,
        emailVerified: claims.emailVerified,
        allowedDomain: s.allowedDomain ?? null,
        autoCreate: s.autoCreateUsers,
        existingUser: existing ? { id: existing.id, status: existing.status } : null,
      });

      if (res.action === 'reject') {
        return reply.redirect('/#/login?sso_error=' + res.reason);
      }

      let userId: string;
      let orgId: string;
      let ssoUserEmail: string;

      if (res.action === 'login') {
        if (!existing) {
          // Should not happen — login implies existing user was found
          return reply.redirect('/#/login?sso_error=auth_failed');
        }
        userId = existing.id;
        orgId = existing.orgId;
        ssoUserEmail = claims.email;
      } else {
        // action === 'create': provision user in the default org
        const [defaultOrg] = await db.select().from(orgs).where(eq(orgs.slug, DEFAULT_ORG_SLUG));
        if (!defaultOrg) {
          req.log?.error?.({}, 'sso auto-create: default org not found');
          return reply.redirect('/#/login?sso_error=auth_failed');
        }

        // Generate an unusable random scrypt hash so the account can never be
        // used for password-based login (same format: scrypt$<16-byte-hex>$<64-byte-hex>)
        const salt = randomBytes(16).toString('hex');
        const hash = randomBytes(64).toString('hex');
        const passwordHash = `scrypt$${salt}$${hash}`;

        const newUser = await usersRepo(db).create({
          orgId: defaultOrg.id,
          email: claims.email,
          name: claims.name ?? claims.email,
          role: 'requester',
          passwordHash,
        });
        userId = newUser.id;
        orgId = newUser.orgId;
        ssoUserEmail = newUser.email;
      }

      const session = await sessionsRepo(db).create({ userId, orgId });
      setSessionCookie(reply, session.id);
      void recordAudit(db, { orgId, actorId: userId, actorEmail: ssoUserEmail, action: 'user.login_sso', ip: req.ip });
      return reply.redirect('/');
    },
  );
}
