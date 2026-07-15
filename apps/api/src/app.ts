// SPDX-License-Identifier: AGPL-3.0-only

import Fastify, { type FastifyInstance } from 'fastify';
import { validatorCompiler, serializerCompiler, type ZodTypeProvider } from 'fastify-type-provider-zod';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import type { Db } from '@tessio/db';
import type { EnterprisePlugin, EnterpriseContext } from '@tessio/entitlements';
import { registerErrorHandler } from './errors';
import { registerAuthContext } from './auth/context';
import { registerOpenApi } from './openapi';
import { registerV1Routes } from './routes';
import { registerAuthRoutes } from './auth/routes';
import { registerPasswordResetRoutes } from './auth/password-reset';
import { registerLoginBrandingRoute } from './resources/login-settings';
import { setSessionCookie } from './auth/cookies';
import { recordAudit, safeMeta } from './audit';
import { registerAgentIngestRoutes } from './agents/ingest-routes';
import { resolveSessionSecret } from './auth/session-secret';
import { type Storage, diskStorage } from './storage/storage';
import { realWorkflowProducers, type WorkflowProducers } from './workflows/producer';

export interface BuildAppOptions {
  db: Db;
  storage?: Storage;
  /** Injectable for tests — the real producers need Redis. */
  workflowProducers?: WorkflowProducers;
  /**
   * The Enterprise Edition plugin, loaded by the composition root in paid
   * editions (see ee/load.ts). Absent in the Community build → core only.
   */
  enterprise?: EnterprisePlugin | null;
}

export function buildApp(opts: BuildAppOptions): FastifyInstance {
  const storage = opts.storage ?? diskStorage(process.env.TESSIO_STORAGE_DIR ?? './.storage');
  const workflowProducers = opts.workflowProducers ?? realWorkflowProducers;
  // Behind Caddy (the only thing that reaches the api), so trust X-Forwarded-For
  // for the real client IP (used by rate limiting). Logging off under test.
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test', trustProxy: true });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.get('/health', async () => ({ status: 'ok' }));

  // Defense-in-depth security headers on every API response. Caddy (the normal
  // front door) already sets the full set including HSTS; these hold even if
  // the api port is ever exposed directly. The CSP is safe because this server
  // returns JSON and raw file downloads, never HTML it wants scriptable.
  app.addHook('onSend', async (_req, reply) => {
    reply.header('x-content-type-options', 'nosniff');
    reply.header('x-frame-options', 'DENY');
    reply.header('referrer-policy', 'strict-origin-when-cross-origin');
    reply.header('content-security-policy', "default-src 'none'; frame-ancestors 'none'");
  });

  app.decorate('db', opts.db);
  registerErrorHandler(app);

  // Global rate limit per client IP (brute-force / abuse / scrypt-CPU DoS). The
  // login route tightens this further (see auth/routes.ts). Disabled under test so
  // the suite's rapid request volume isn't throttled; route-level `config.rateLimit`
  // is inert when the plugin isn't registered.
  if (process.env.NODE_ENV !== 'test') {
    app.register(rateLimit, { max: 300, timeWindow: '1 minute' });
  }
  app.register(cookie, { secret: resolveSessionSecret(process.env.NODE_ENV, process.env.SESSION_SECRET) });
  app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });

  // Core capabilities injected into the Enterprise Edition plugin so ee/ never
  // imports from apps/api (the boundary is one-directional — see LICENSING.md).
  const enterprise = opts.enterprise ?? null;
  const eeCtx: EnterpriseContext = { db: opts.db, setSessionCookie, recordAudit, safeMeta };

  // /api/v1: OpenAPI doc on the parent (no org hook); org-scoped routes in a child scope.
  app.register(
    async (v1) => {
      await registerOpenApi(v1);
      registerAuthRoutes(v1, opts.db);
      registerPasswordResetRoutes(v1, opts.db, workflowProducers);
      // Sign-in screen branding — public, read-only (see resources/login-settings.ts).
      registerLoginBrandingRoute(v1, opts.db);
      // Enterprise public (pre-session) routes, e.g. SSO start/callback/info.
      enterprise?.registerPublic?.(v1, eeCtx);
      // Endpoint-agent ingest: Bearer-token auth, NOT the session-cookie scope below.
      registerAgentIngestRoutes(v1, opts.db);
      v1.register(async (scope) => {
        registerAuthContext(scope, opts.db);
        scope.withTypeProvider<ZodTypeProvider>().get('/_whoami', async (req) => ({ orgId: req.orgId }));
        registerV1Routes(scope, opts.db, storage, workflowProducers, { enterprise, eeCtx });
      });
    },
    { prefix: '/api/v1' },
  );

  return app;
}

declare module 'fastify' {
  interface FastifyInstance {
    db: Db;
  }
}
