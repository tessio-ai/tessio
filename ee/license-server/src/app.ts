// SPDX-License-Identifier: LicenseRef-Tessio-Commercial

/**
 * The Tessio license server — vendor-hosted infrastructure, NOT shipped to
 * customers (it lives in ee/ and holds the private signing key). It answers the
 * daily check-in from every customer instance and ingests Stripe webhooks.
 *
 *   POST /license/check-in  { token }        → { token, edition, expiresAt } | 403
 *   POST /stripe/webhook     <stripe event>  → { received: true }
 *   GET  /health
 */

import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { SubscriptionStore } from './store';
import { issueEntitlement } from './issue';
import { verifyStripeSignature, subscriptionFromEvent } from './stripe';

export interface LicenseServerOptions {
  store: SubscriptionStore;
  /** Raw base64url Ed25519 private seed, from your secret store. Never hard-coded. */
  privateKey: string;
  /** Stripe webhook signing secret. When unset, the webhook route is disabled. */
  stripeWebhookSecret?: string;
  /** Entitlement token lifetime = the customer's offline grace window. Default 14d. */
  ttlSeconds?: number;
  /** Injectable clock (unix seconds) for tests. */
  now?: () => number;
}

const checkInBody = z.object({ token: z.string().min(1) });

export function buildLicenseServer(opts: LicenseServerOptions): FastifyInstance {
  const ttlSeconds = opts.ttlSeconds ?? 14 * 24 * 60 * 60;
  const now = opts.now ?? (() => Math.floor(Date.now() / 1000));
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' });

  // Keep the raw body (Stripe signatures are computed over the exact bytes) while
  // still handing routes a parsed object.
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    (req as FastifyRequest & { rawBody?: string }).rawBody = body as string;
    try {
      done(null, body ? JSON.parse(body as string) : {});
    } catch (err) {
      done(err as Error);
    }
  });

  app.get('/health', async () => ({ status: 'ok' }));

  // Daily check-in: exchange a stable opaque token for a short-TTL entitlement.
  app.post('/license/check-in', async (req, reply) => {
    const parsed = checkInBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'missing token' });

    const sub = await opts.store.lookup(parsed.data.token);
    if (!sub || !sub.active) {
      // 403, not 404: a known-but-lapsed token and an unknown token look the same.
      return reply.code(403).send({ error: 'no active subscription for this license key' });
    }
    return issueEntitlement(sub, { now: now(), ttlSeconds, privateKey: opts.privateKey });
  });

  // Stripe → source of truth. Verifies the signature, then upserts our record.
  if (opts.stripeWebhookSecret) {
    app.post('/stripe/webhook', async (req, reply) => {
      const raw = (req as FastifyRequest & { rawBody?: string }).rawBody ?? '';
      const sigOk = verifyStripeSignature(raw, req.headers['stripe-signature'] as string | undefined, opts.stripeWebhookSecret!, now());
      if (!sigOk) return reply.code(400).send({ error: 'invalid signature' });

      const mapped = subscriptionFromEvent(req.body);
      if (mapped) await opts.store.upsert(mapped.token, mapped.subscription);
      return { received: true };
    });
  }

  return app;
}
