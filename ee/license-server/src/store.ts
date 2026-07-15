// SPDX-License-Identifier: LicenseRef-Tessio-Commercial

/**
 * Subscription store — the source of truth for "is this license token backed by
 * an active subscription, and what does it grant". It is keyed by the customer's
 * stable, opaque license token (the value they put in TESSIO_LICENSE_KEY).
 *
 * Stripe drives the contents: the webhook handler (see stripe.ts) upserts a
 * record whenever a subscription changes. `lookup` is what the check-in route
 * calls on every daily poll. In production this is backed by your database; the
 * in-memory implementation here is for local dev and tests.
 */

import type { Edition, Feature } from '@tessio/entitlements';

export interface Subscription {
  /** Whether the subscription currently entitles the customer (active/trialing). */
  active: boolean;
  /** Paid edition the subscription grants. */
  edition: Edition;
  /** Optional feature subset; when absent the edition's full set applies. */
  features?: Feature[];
  /**
   * Total billable seats (active admins + agents) the subscription pays for,
   * INCLUDING the free allotment. Mirrors the Stripe subscription quantity.
   * `null` = unlimited (site license); absent = free allotment only.
   */
  seats?: number | null;
  /** Who the license is for (company/org), surfaced in the signed token + UI. */
  subject: string;
  /** Opaque license id for support/ledger correlation. */
  licenseId: string;
}

export interface SubscriptionStore {
  /** Look up the subscription for an opaque license token (null = unknown). */
  lookup(token: string): Promise<Subscription | null>;
  /** Insert/replace the record for a token (called by the Stripe webhook). */
  upsert(token: string, sub: Subscription): Promise<void>;
}

/** In-memory store for dev/tests. Production should back this with a database. */
export class InMemorySubscriptionStore implements SubscriptionStore {
  private readonly map = new Map<string, Subscription>();

  constructor(seed?: Record<string, Subscription>) {
    if (seed) for (const [k, v] of Object.entries(seed)) this.map.set(k, v);
  }

  async lookup(token: string): Promise<Subscription | null> {
    return this.map.get(token) ?? null;
  }

  async upsert(token: string, sub: Subscription): Promise<void> {
    this.map.set(token, sub);
  }
}
