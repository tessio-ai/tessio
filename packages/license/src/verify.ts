// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Signed license-token verification. This is the trust primitive of the whole
 * system: every running Tessio instance verifies tokens locally with only the
 * PUBLIC key, so a paid edition can never be self-asserted by a bare env var.
 *
 * Two kinds of token flow through here, both the same format:
 *   - short-TTL "entitlement" tokens the license server mints on each daily
 *     check-in (the normal hosted path — see checkin.ts);
 *   - long-lived "offline" tokens issued by the CLI for air-gapped customers.
 * Verification treats them identically — it only cares that the signature and
 * expiry hold.
 *
 * This lives in core (AGPL): it needs only the public key and is safe to ship.
 */

import { verify as edVerify, type KeyObject } from 'node:crypto';
import { parseEdition, type Edition, type Feature, FEATURE_KEYS } from '@tessio/entitlements';
import { parseToken, decodePayload } from './format';
import { publicKeyFromRaw } from './keys';

/**
 * Tessio's canonical license-signing PUBLIC key (raw 32-byte Ed25519, base64url).
 *
 * PLACEHOLDER: replace with the real production public key before shipping paid
 * builds. Generate the pair with the CLI's `keygen`, publish the public half
 * here, and keep the private half in the license server's secret store only.
 * Baking the key into source (rather than reading it from env) is deliberate: a
 * customer must not be able to point verification at a key they control.
 */
export const CANONICAL_PUBLIC_KEY_B64URL = 'Zm4xy0t0X1nvYu9dxPtsEBPwy3E2ofXWzgPQl5hYs0g';

/** The verified, trusted claims carried by a valid token. */
export interface LicenseClaims {
  edition: Edition;
  features?: Feature[];
  /**
   * Total billable seats granted (including the free allotment). `null` =
   * unlimited (site license). `undefined` = the token carries no seat grant,
   * so the instance keeps only the free allotment.
   */
  seats?: number | null;
  subject: string;
  licenseId: string;
  issuedAt: number;
  expiresAt: number | null;
}

export type VerifyResult =
  | { ok: true; claims: LicenseClaims }
  | { ok: false; reason: string };

interface RawPayload {
  v?: unknown;
  edition?: unknown;
  features?: unknown;
  seats?: unknown;
  sub?: unknown;
  lid?: unknown;
  iat?: unknown;
  exp?: unknown;
}

let cachedCanonicalKey: KeyObject | undefined;
function canonicalKey(): KeyObject {
  return (cachedCanonicalKey ??= publicKeyFromRaw(CANONICAL_PUBLIC_KEY_B64URL));
}

/**
 * Verify a token. Returns the trusted claims on success, or a reason on failure
 * — callers MUST treat any failure as "no entitlement" (fail closed).
 *
 * @param opts.now        current time, unix seconds (injected for testability)
 * @param opts.publicKey  override the baked-in key (tests only)
 */
export function verifyLicenseKey(
  token: string | undefined | null,
  opts: { now: number; publicKey?: KeyObject },
): VerifyResult {
  if (!token || typeof token !== 'string') return { ok: false, reason: 'no license token present' };

  const parsed = parseToken(token);
  if (!parsed) return { ok: false, reason: 'malformed or unsupported license token' };

  // 1) Signature must verify against the trusted public key.
  let signatureOk: boolean;
  try {
    const key = opts.publicKey ?? canonicalKey();
    signatureOk = edVerify(null, Buffer.from(parsed.signingInput, 'utf8'), key, Buffer.from(parsed.sigSeg, 'base64url'));
  } catch {
    signatureOk = false;
  }
  if (!signatureOk) return { ok: false, reason: 'license signature verification failed' };

  // 2) Payload must parse and carry a paid edition.
  let raw: RawPayload;
  try {
    raw = decodePayload(parsed.payloadSeg) as RawPayload;
  } catch {
    return { ok: false, reason: 'license payload is not valid JSON' };
  }
  if (raw.v !== 1) return { ok: false, reason: 'unsupported license payload version' };

  const edition = parseEdition(typeof raw.edition === 'string' ? raw.edition : undefined);
  if (edition === 'community') return { ok: false, reason: 'license does not grant a paid edition' };

  // 3) Expiry (null = perpetual).
  const expiresAt = raw.exp === null || raw.exp === undefined ? null : Number(raw.exp);
  if (expiresAt !== null && (!Number.isFinite(expiresAt) || opts.now >= expiresAt)) {
    return { ok: false, reason: 'license has expired' };
  }

  const features = Array.isArray(raw.features)
    ? raw.features.filter((f): f is Feature => FEATURE_KEYS.includes(f as Feature))
    : undefined;

  // 4) Seats: absent → no grant; null → unlimited; otherwise must be a positive
  //    integer. A malformed seats claim rejects the whole token (fail closed)
  //    rather than silently granting some other amount.
  let seats: number | null | undefined;
  if (raw.seats === undefined) seats = undefined;
  else if (raw.seats === null) seats = null;
  else if (typeof raw.seats === 'number' && Number.isInteger(raw.seats) && raw.seats > 0) seats = raw.seats;
  else return { ok: false, reason: 'license seats claim is invalid' };

  return {
    ok: true,
    claims: {
      edition,
      features,
      seats,
      subject: typeof raw.sub === 'string' ? raw.sub : 'unknown',
      licenseId: typeof raw.lid === 'string' ? raw.lid : 'unknown',
      issuedAt: Number.isFinite(Number(raw.iat)) ? Number(raw.iat) : 0,
      expiresAt,
    },
  };
}
