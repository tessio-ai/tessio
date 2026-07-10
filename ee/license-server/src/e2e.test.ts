// SPDX-License-Identifier: LicenseRef-Tessio-Commercial

/**
 * End-to-end: the REAL license server issues a token that the REAL client
 * check-in verifies and the REAL boot resolver turns into an edition — the whole
 * hosted round trip, with only the network hop faked (app.inject instead of TCP).
 */

import { describe, it, expect } from 'vitest';
import { createLicenseClient, resolveEffectiveEdition, publicKeyFromRaw, generateKeypair, type FetchLike } from '@tessio/license';
import { buildLicenseServer } from './app';
import { InMemorySubscriptionStore } from './store';

const NOW = 1_700_000_000;

describe('hosted licensing end-to-end', () => {
  it('opaque token → server issues → client caches → resolver unlocks enterprise', async () => {
    const keys = generateKeypair();
    const pub = publicKeyFromRaw(keys.publicKey); // stands in for the baked-in canonical key

    const store = new InMemorySubscriptionStore({
      tok_customer: { active: true, edition: 'enterprise', subject: 'Acme Corp', licenseId: 'lic_42' },
    });
    const app = buildLicenseServer({ store, privateKey: keys.privateKey, now: () => NOW });

    // Adapt Fastify's inject() to the client's FetchLike interface.
    const fetchImpl: FetchLike = async (url, init) => {
      const res = await app.inject({ method: 'POST', url, payload: init.body, headers: init.headers });
      return { ok: res.statusCode < 400, status: res.statusCode, json: async () => res.json() };
    };

    const cache: Record<string, string> = {};
    const client = createLicenseClient({
      storeToken: 'tok_customer',
      checkInUrl: '/license/check-in',
      cachePath: 'mem',
      fetchImpl,
      readCache: (p) => cache[p],
      writeCache: (p, t) => {
        cache[p] = t;
      },
    });

    const resolvedToken = await client.resolveInitial();
    expect(resolvedToken.source).toBe('checkin');

    const edition = resolveEffectiveEdition({
      requestedEdition: 'enterprise',
      signedToken: resolvedToken.signedToken,
      now: NOW,
      publicKey: pub,
    });
    expect(edition).toMatchObject({ edition: 'enterprise', downgraded: false });
    expect(edition.license?.subject).toBe('Acme Corp');
    expect(cache.mem).toBe(resolvedToken.signedToken); // cached for offline grace

    // Simulate the subscription lapsing: server now refuses, but the cached token
    // keeps the instance on enterprise until its 14-day TTL runs out (grace window).
    await store.upsert('tok_customer', { active: false, edition: 'enterprise', subject: 'Acme Corp', licenseId: 'lic_42' });
    const afterLapse = await client.resolveInitial();
    expect(afterLapse.source).toBe('cache');

    // ...and once past the TTL, verification fails closed → community.
    const expired = resolveEffectiveEdition({
      requestedEdition: 'enterprise',
      signedToken: afterLapse.signedToken,
      now: NOW + 15 * 86400,
      publicKey: pub,
    });
    expect(expired).toMatchObject({ edition: 'community', downgraded: true });
  });
});
