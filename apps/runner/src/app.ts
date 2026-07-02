// SPDX-License-Identifier: AGPL-3.0-only

import { timingSafeEqual } from 'node:crypto';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { runSnippet } from './run-snippet';

interface RunBody {
  code: string;
  ctx?: unknown;
  timeoutMs?: number;
}

/** Hard server-side cap regardless of what the caller asks for. */
const TIMEOUT_MAX_MS = 5_000;

/** Constant-time bearer-token check against RUNNER_TOKEN, when one is configured. */
function isAuthorized(req: FastifyRequest, token: string): boolean {
  const header = req.headers.authorization ?? '';
  const presented = header.startsWith('Bearer ') ? header.slice(7) : '';
  const a = Buffer.from(presented);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: false });
  const token = process.env.RUNNER_TOKEN ?? '';
  if (!token && process.env.NODE_ENV === 'production') {
    app.log.warn('RUNNER_TOKEN is not set — the /run endpoint is unauthenticated.');
  }

  app.get('/health', async () => ({ status: 'ok' }));

  app.post<{ Body: RunBody }>('/run', async (req, reply) => {
    // When a token is configured, require it. Only the worker holds the token, so an
    // attacker who reaches the runner's port cannot run arbitrary code without it.
    if (token && !isAuthorized(req, token)) {
      reply.code(401);
      return { error: 'Unauthorized' };
    }
    const { code, ctx, timeoutMs } = req.body;
    try {
      return await runSnippet(code, ctx ?? {}, Math.min(timeoutMs ?? 1_000, TIMEOUT_MAX_MS));
    } catch (err) {
      // A throwing/timed-out snippet is a client error, not a runner crash.
      reply.code(422);
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  return app;
}
