// SPDX-License-Identifier: LicenseRef-Tessio-Commercial

/**
 * Stripe as the source of truth. Two concerns, both kept pure + testable so no
 * live Stripe account or SDK is needed to exercise them:
 *
 *   1. verifyStripeSignature — validates the `Stripe-Signature` header exactly as
 *      Stripe's SDK does (HMAC-SHA256 over `${timestamp}.${rawBody}`), so we can
 *      trust a webhook without pulling in the `stripe` package.
 *   2. subscriptionFromEvent — maps a subscription event to our Subscription
 *      record. The customer's stable license token and the edition travel in the
 *      subscription's `metadata` (set when you create the Checkout Session):
 *        metadata.tessio_license_token, metadata.tessio_edition,
 *        metadata.tessio_features (comma-separated, optional), metadata.tessio_subject,
 *        metadata.tessio_seats ('unlimited' or a number, optional — overrides quantity)
 *
 * Per-seat pricing: the subscription's item QUANTITY is the customer's TOTAL
 * seat count (active admins + agents). Model the "first N free, then $X/user/mo"
 * tier in the Stripe Price itself (graduated tiers: the free allotment at $0,
 * every further unit at the per-user price) so the monthly price is set in the
 * Stripe dashboard, never in code. Quantity changes flow through
 * `customer.subscription.updated` events, so an upgrade/downgrade lands in the
 * signed entitlement on the customer's next daily check-in.
 *
 * Wire these into whatever creates subscriptions (a Checkout Session with those
 * metadata keys); nothing else here needs to change.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { EDITIONS, parseSeats, type Edition, type Feature, FEATURE_KEYS } from '@tessio/entitlements';
import type { Subscription } from './store';

/** Verify a Stripe webhook signature. Returns true iff the payload is authentic. */
export function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string | undefined,
  secret: string,
  now: number,
  toleranceSec = 300,
): boolean {
  if (!signatureHeader) return false;
  // Header looks like: t=1700000000,v1=hex,v1=hex2
  const parts = Object.fromEntries(
    signatureHeader.split(',').map((kv) => {
      const i = kv.indexOf('=');
      return [kv.slice(0, i), kv.slice(i + 1)];
    }),
  );
  const t = Number(parts.t);
  if (!Number.isFinite(t) || Math.abs(now - t) > toleranceSec) return false;

  const expected = createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
  // Stripe may send multiple v1 signatures; accept if any matches.
  const provided = signatureHeader
    .split(',')
    .filter((kv) => kv.startsWith('v1='))
    .map((kv) => kv.slice(3));
  return provided.some((sig) => {
    const a = Buffer.from(sig, 'hex');
    const b = Buffer.from(expected, 'hex');
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

const ACTIVE_STATUSES = new Set(['active', 'trialing', 'past_due']);

interface StripeSubscriptionObject {
  status?: string;
  metadata?: Record<string, string>;
  /** Set on single-item subscriptions; per-seat plans put the seat total here. */
  quantity?: number;
  items?: { data?: Array<{ quantity?: number }> };
}
interface StripeEvent {
  type?: string;
  data?: { object?: StripeSubscriptionObject };
}

/**
 * Map a parsed Stripe event to a (token, Subscription) upsert, or null if the
 * event isn't a subscription change we care about / is missing our metadata.
 */
export function subscriptionFromEvent(event: unknown): { token: string; subscription: Subscription } | null {
  const e = event as StripeEvent;
  if (!e.type || !e.type.startsWith('customer.subscription.')) return null;

  const obj = e.data?.object;
  const meta = obj?.metadata ?? {};
  const token = meta.tessio_license_token;
  const edition = meta.tessio_edition as Edition | undefined;
  if (!token || !edition || !EDITIONS.includes(edition) || edition === 'community') return null;

  // A deleted subscription (or any non-active status) revokes entitlement.
  const active = e.type !== 'customer.subscription.deleted' && ACTIVE_STATUSES.has(obj?.status ?? '');
  const features = meta.tessio_features
    ? (meta.tessio_features.split(',').map((f) => f.trim()).filter((f): f is Feature => FEATURE_KEYS.includes(f as Feature)))
    : undefined;

  return {
    token,
    subscription: { active, edition, features, seats: seatsFromSubscription(obj), subject: meta.tessio_subject ?? 'unknown', licenseId: token },
  };
}

/**
 * The seat total a subscription pays for: `metadata.tessio_seats` when present
 * ('unlimited' → null, i.e. a site license — parsed by the shared seats
 * grammar), otherwise the item quantity. The item fallback applies ONLY to
 * single-item subscriptions: with multiple items Stripe's ordering is
 * arbitrary, so guessing an item could grant a support add-on's quantity as
 * seats — multi-item subscriptions must set tessio_seats explicitly.
 * Anything unparseable yields undefined (free allotment only) — never unlimited.
 */
function seatsFromSubscription(obj: StripeSubscriptionObject | undefined): number | null | undefined {
  const meta = obj?.metadata ?? {};
  if (meta.tessio_seats !== undefined) return parseSeats(meta.tessio_seats);
  const items = obj?.items?.data;
  const qty = obj?.quantity ?? (items && items.length === 1 ? items[0].quantity : undefined);
  return typeof qty === 'number' && Number.isInteger(qty) && qty > 0 ? qty : undefined;
}
