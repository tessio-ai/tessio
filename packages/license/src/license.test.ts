// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { publicKeyFromRaw, generateKeypair } from './keys';
import { signLicense } from './sign';
import { verifyLicenseKey } from './verify';
import { resolveEffectiveEdition } from './resolve';
import { createLicenseClient } from './checkin';
import { isSignedToken } from './format';

const NOW = 1_700_000_000; // fixed clock (unix seconds)

/** A vendor keypair + its public KeyObject for verification. */
function issuer() {
  const { publicKey, privateKey } = generateKeypair();
  return { privateKey, publicKey: publicKeyFromRaw(publicKey) };
}

describe('sign → verify round trip', () => {
  it('accepts a freshly signed, unexpired paid token', () => {
    const iss = issuer();
    const token = signLicense({ edition: 'enterprise', subject: 'Acme', ttlSeconds: 14 * 86400, now: NOW }, iss.privateKey);
    const res = verifyLicenseKey(token, { now: NOW, publicKey: iss.publicKey });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.claims.edition).toBe('enterprise');
      expect(res.claims.subject).toBe('Acme');
      expect(res.claims.expiresAt).toBe(NOW + 14 * 86400);
    }
  });

  it('rejects a token signed by a different key (forgery)', () => {
    const good = issuer();
    const attacker = issuer();
    const token = signLicense({ edition: 'enterprise', subject: 'x', ttlSeconds: 86400, now: NOW }, attacker.privateKey);
    expect(verifyLicenseKey(token, { now: NOW, publicKey: good.publicKey })).toMatchObject({ ok: false });
  });

  it('rejects an expired token', () => {
    const iss = issuer();
    const token = signLicense({ edition: 'enterprise', subject: 'x', ttlSeconds: 10, now: NOW }, iss.privateKey);
    expect(verifyLicenseKey(token, { now: NOW + 11, publicKey: iss.publicKey })).toMatchObject({
      ok: false,
      reason: expect.stringContaining('expired'),
    });
  });

  it('refuses to sign a community token', () => {
    const iss = issuer();
    expect(() => signLicense({ edition: 'community', subject: 'x', now: NOW } as never, iss.privateKey)).toThrow();
  });

  it('carries an explicit feature subset through', () => {
    const iss = issuer();
    const token = signLicense({ edition: 'enterprise', subject: 'x', features: ['sso'], ttlSeconds: 86400, now: NOW }, iss.privateKey);
    const res = verifyLicenseKey(token, { now: NOW, publicKey: iss.publicKey });
    if (res.ok) expect(res.claims.features).toEqual(['sso']);
  });
});

describe('resolveEffectiveEdition (fail-closed)', () => {
  it('community needs no token', () => {
    expect(resolveEffectiveEdition({ requestedEdition: 'community', signedToken: undefined, now: NOW })).toMatchObject({
      edition: 'community',
      downgraded: false,
    });
  });

  it('paid request with no token downgrades to community', () => {
    expect(resolveEffectiveEdition({ requestedEdition: 'enterprise', signedToken: undefined, now: NOW })).toMatchObject({
      edition: 'community',
      downgraded: true,
    });
  });

  it('paid request with a valid token runs at the token edition', () => {
    const iss = issuer();
    const token = signLicense({ edition: 'enterprise', subject: 'Acme', ttlSeconds: 86400, now: NOW }, iss.privateKey);
    const r = resolveEffectiveEdition({ requestedEdition: 'enterprise', signedToken: token, now: NOW, publicKey: iss.publicKey });
    expect(r).toMatchObject({ edition: 'enterprise', downgraded: false });
    expect(r.license?.subject).toBe('Acme');
  });
});

describe('license client check-in', () => {
  const cachePath = '/tmp/unused-cache.json';

  /** A stub license server that hands back a signed token for a valid opaque key. */
  function server(iss: ReturnType<typeof issuer>, valid: boolean) {
    const calls: string[] = [];
    const fetchImpl = async (_url: string, init: { body: string }) => {
      calls.push(init.body);
      if (!valid) return { ok: false, status: 403, json: async () => ({ error: 'no active subscription' }) };
      const token = signLicense({ edition: 'enterprise', subject: 'Acme', ttlSeconds: 14 * 86400, now: NOW }, iss.privateKey);
      return { ok: true, status: 200, json: async () => ({ token }) };
    };
    return { fetchImpl, calls };
  }

  it('exchanges an opaque token for a signed entitlement and caches it', async () => {
    const iss = issuer();
    const srv = server(iss, true);
    const cache: Record<string, string> = {};
    const client = createLicenseClient({
      storeToken: 'tessio_store_opaque_key',
      checkInUrl: 'https://license.test/check-in',
      cachePath,
      fetchImpl: srv.fetchImpl,
      readCache: (p) => cache[p],
      writeCache: (p, t) => {
        cache[p] = t;
      },
    });
    const resolved = await client.resolveInitial();
    expect(resolved.source).toBe('checkin');
    expect(isSignedToken(resolved.signedToken)).toBe(true);
    expect(cache[cachePath]).toBe(resolved.signedToken); // cached for offline grace
    // and the token verifies for real
    expect(verifyLicenseKey(resolved.signedToken, { now: NOW, publicKey: iss.publicKey }).ok).toBe(true);
  });

  it('falls back to the cached token when check-in fails (offline grace)', async () => {
    const iss = issuer();
    const cachedToken = signLicense({ edition: 'enterprise', subject: 'Acme', ttlSeconds: 14 * 86400, now: NOW }, iss.privateKey);
    const srv = server(iss, false); // server refuses
    const client = createLicenseClient({
      storeToken: 'tessio_store_opaque_key',
      checkInUrl: 'https://license.test/check-in',
      cachePath,
      fetchImpl: srv.fetchImpl,
      readCache: () => cachedToken,
      writeCache: () => {},
    });
    const resolved = await client.resolveInitial();
    expect(resolved.source).toBe('cache');
    expect(resolved.signedToken).toBe(cachedToken);
  });

  it('uses a signed offline token directly without any network call', async () => {
    const iss = issuer();
    const offline = signLicense({ edition: 'enterprise', subject: 'AirGap', ttlSeconds: 365 * 86400, now: NOW }, iss.privateKey);
    let fetched = false;
    const client = createLicenseClient({
      storeToken: offline,
      checkInUrl: 'https://license.test/check-in',
      cachePath,
      fetchImpl: async () => {
        fetched = true;
        return { ok: true, status: 200, json: async () => ({}) };
      },
      readCache: () => undefined,
      writeCache: () => {},
    });
    const resolved = await client.resolveInitial();
    expect(resolved.source).toBe('offline');
    expect(resolved.signedToken).toBe(offline);
    expect(fetched).toBe(false); // air-gap: never phones home
  });

  it('reports "none" when there is neither a live server nor a cache', async () => {
    const client = createLicenseClient({
      storeToken: 'tessio_store_opaque_key',
      checkInUrl: 'https://license.test/check-in',
      cachePath,
      fetchImpl: async () => ({ ok: false, status: 500, json: async () => ({}) }),
      readCache: () => undefined,
      writeCache: () => {},
    });
    const resolved = await client.resolveInitial();
    expect(resolved.source).toBe('none');
    expect(resolved.reason).toBeTruthy();
  });
});
