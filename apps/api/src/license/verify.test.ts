// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { generateKeyPairSync, sign as edSign, createPublicKey, createPrivateKey, type KeyObject } from 'node:crypto';
import { verifyLicenseKey } from './verify';
import { resolveEffectiveEdition } from './resolve';

const NOW = 1_700_000_000; // fixed clock (unix seconds) so nothing depends on wall time

/** Mint a keypair + a signing helper that produces tessio-lic.v1 tokens. */
function makeIssuer() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const pubRaw = publicKey.export({ type: 'spki', format: 'der' }).subarray(-32);
  const privRaw = privateKey.export({ type: 'pkcs8', format: 'der' }).subarray(-32);

  const pubKeyObj: KeyObject = createPublicKey({
    key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), pubRaw]),
    format: 'der',
    type: 'spki',
  });
  const privKeyObj = createPrivateKey({
    key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), privRaw]),
    format: 'der',
    type: 'pkcs8',
  });

  function token(payload: Record<string, unknown>): string {
    const seg = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const input = `tessio-lic.v1.${seg}`;
    const sig = edSign(null, Buffer.from(input, 'utf8'), privKeyObj).toString('base64url');
    return `${input}.${sig}`;
  }
  return { publicKey: pubKeyObj, token };
}

const base = { v: 1, edition: 'enterprise', sub: 'Acme', lid: 'lic_1', iat: NOW, exp: null as number | null };

describe('verifyLicenseKey', () => {
  it('accepts a well-formed, correctly-signed, unexpired token', () => {
    const { publicKey, token } = makeIssuer();
    const res = verifyLicenseKey(token(base), { now: NOW, publicKey });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.claims.edition).toBe('enterprise');
      expect(res.claims.subject).toBe('Acme');
      expect(res.claims.expiresAt).toBeNull();
    }
  });

  it('rejects a token signed by a different key (forgery)', () => {
    const issuer = makeIssuer();
    const attacker = makeIssuer();
    // token minted by the attacker, checked against the real public key
    const res = verifyLicenseKey(attacker.token(base), { now: NOW, publicKey: issuer.publicKey });
    expect(res).toMatchObject({ ok: false });
  });

  it('rejects a tampered payload (edition upgraded after signing)', () => {
    const { publicKey, token } = makeIssuer();
    const good = token({ ...base, edition: 'enterprise' });
    const [p, v, , sig] = good.split('.');
    const forgedPayload = Buffer.from(JSON.stringify({ ...base, edition: 'cloud' })).toString('base64url');
    const tampered = [p, v, forgedPayload, sig].join('.');
    const res = verifyLicenseKey(tampered, { now: NOW, publicKey });
    expect(res).toMatchObject({ ok: false });
  });

  it('rejects an expired token', () => {
    const { publicKey, token } = makeIssuer();
    const res = verifyLicenseKey(token({ ...base, exp: NOW - 1 }), { now: NOW, publicKey });
    expect(res).toMatchObject({ ok: false, reason: expect.stringContaining('expired') });
  });

  it('accepts a token that is still within its window', () => {
    const { publicKey, token } = makeIssuer();
    const res = verifyLicenseKey(token({ ...base, exp: NOW + 86400 }), { now: NOW, publicKey });
    expect(res.ok).toBe(true);
  });

  it('rejects a community token (no paid grant)', () => {
    const { publicKey, token } = makeIssuer();
    const res = verifyLicenseKey(token({ ...base, edition: 'community' }), { now: NOW, publicKey });
    expect(res).toMatchObject({ ok: false });
  });

  it('rejects missing / malformed tokens', () => {
    const { publicKey } = makeIssuer();
    expect(verifyLicenseKey(undefined, { now: NOW, publicKey })).toMatchObject({ ok: false });
    expect(verifyLicenseKey('', { now: NOW, publicKey })).toMatchObject({ ok: false });
    expect(verifyLicenseKey('not-a-token', { now: NOW, publicKey })).toMatchObject({ ok: false });
    expect(verifyLicenseKey('tessio-lic.v2.x.y', { now: NOW, publicKey })).toMatchObject({ ok: false });
  });

  it('keeps only known feature names from the allow-list', () => {
    const { publicKey, token } = makeIssuer();
    const res = verifyLicenseKey(token({ ...base, features: ['sso', 'not_a_feature'] }), { now: NOW, publicKey });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.claims.features).toEqual(['sso']);
  });
});

describe('resolveEffectiveEdition (fail-closed boot seam)', () => {
  it('community needs no license and is never downgraded', () => {
    const r = resolveEffectiveEdition({ requestedEdition: 'community', licenseKey: undefined, now: NOW });
    expect(r).toMatchObject({ edition: 'community', downgraded: false });
  });

  it('downgrades a paid request with no license key to community', () => {
    const r = resolveEffectiveEdition({ requestedEdition: 'enterprise', licenseKey: undefined, now: NOW });
    expect(r).toMatchObject({ edition: 'community', downgraded: true });
    expect(r.reason).toBeTruthy();
  });

  it('downgrades a paid request with a garbage license key', () => {
    const r = resolveEffectiveEdition({ requestedEdition: 'enterprise', licenseKey: 'tessio-lic.v1.aaa.bbb', now: NOW });
    expect(r).toMatchObject({ edition: 'community', downgraded: true });
  });
});
