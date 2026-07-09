// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Signed license-key verification for Tessio's paid editions.
 *
 * This is the technical half of the "clean seam" LICENSING.md promised: it turns
 * the edition switch from a bare `TESSIO_EDITION` env var into something that
 * must be backed by a license token the vendor signed with a private key held
 * offline. Setting `TESSIO_EDITION=enterprise` is no longer sufficient on its
 * own — the composition root (see ./resolve.ts) fails closed to Community unless
 * a matching, unexpired, correctly-signed token is also present.
 *
 * The scheme is intentionally boring and dependency-free:
 *   - Ed25519 signatures via Node's built-in `crypto` (no third-party libs).
 *   - A compact, JWT-shaped token so it is easy to paste into an env var:
 *       tessio-lic.v1.<base64url(payloadJSON)>.<base64url(signature)>
 *   - The signature covers the ASCII bytes `tessio-lic.v1.<base64url(payload)>`.
 *
 * This lives in core (AGPL): verification uses only the PUBLIC key, so it is
 * safe to ship. The private signing key never appears in this repository — the
 * vendor keeps it offline and uses ./sign.ts to mint tokens. Because Tessio is
 * open source, a self-hoster with the `ee/` code could of course patch this
 * check out; the point is to move the bar from "set an env var" to "modify and
 * rebuild the licensed source", which is the line that matters both technically
 * and contractually (see ee/LICENSE). This is licensing, not DRM.
 */

import { verify as edVerify, createPublicKey, type KeyObject } from 'node:crypto';
import { parseEdition, type Edition, type Feature, FEATURE_KEYS } from '@tessio/entitlements';

const TOKEN_PREFIX = 'tessio-lic';
const TOKEN_VERSION = 'v1';

/**
 * Tessio's canonical license-signing PUBLIC key (raw 32-byte Ed25519, base64url).
 *
 * PLACEHOLDER: replace this with the real production public key before shipping
 * paid builds. The matching private key must be generated with `sign.ts keygen`
 * and stored offline (an HSM / secrets vault) — never in the repo. Baking the
 * key into the source (rather than reading it from env) is deliberate: a
 * customer must not be able to point verification at a key they control.
 */
const CANONICAL_PUBLIC_KEY_B64URL = 'Zm4xy0t0X1nvYu9dxPtsEBPwy3E2ofXWzgPQl5hYs0g';

/** The verified, trusted claims carried by a valid license token. */
export interface LicenseClaims {
  /** Edition the license grants. Always a paid edition; community needs no key. */
  edition: Edition;
  /**
   * Optional explicit feature allow-list. When present, it further narrows what
   * the edition grants (a license may sell a subset). When absent, the edition's
   * full feature set applies. Unknown feature names are ignored.
   */
  features?: Feature[];
  /** Who the license was issued to (org / company name), for display + support. */
  subject: string;
  /** Opaque license id, for revocation lists / support lookups. */
  licenseId: string;
  /** Issued-at, unix seconds. */
  issuedAt: number;
  /** Expiry, unix seconds. `null` = perpetual. */
  expiresAt: number | null;
}

export type VerifyResult =
  | { ok: true; claims: LicenseClaims }
  | { ok: false; reason: string };

interface RawPayload {
  v?: unknown;
  edition?: unknown;
  features?: unknown;
  sub?: unknown;
  lid?: unknown;
  iat?: unknown;
  exp?: unknown;
}

function decodeCanonicalKey(b64url: string): KeyObject {
  // Wrap the raw 32-byte Ed25519 key in a minimal SPKI DER header so
  // createPublicKey accepts it. This 12-byte prefix is the fixed Ed25519 OID.
  const raw = Buffer.from(b64url, 'base64url');
  const spkiHeader = Buffer.from('302a300506032b6570032100', 'hex');
  const der = Buffer.concat([spkiHeader, raw]);
  return createPublicKey({ key: der, format: 'der', type: 'spki' });
}

/**
 * Verify a license token. Returns the trusted claims on success, or a reason on
 * failure — callers must treat any failure as "no entitlement" (fail closed).
 *
 * @param token       the `tessio-lic.v1.…` string (e.g. from `TESSIO_LICENSE_KEY`)
 * @param opts.now    current time in unix seconds (injected for testability)
 * @param opts.publicKey  override the baked-in key (tests only; production uses canonical)
 */
export function verifyLicenseKey(
  token: string | undefined | null,
  opts: { now: number; publicKey?: KeyObject } = { now: Math.floor(nowMs() / 1000) },
): VerifyResult {
  if (!token || typeof token !== 'string') return { ok: false, reason: 'no license key present' };

  const parts = token.trim().split('.');
  if (parts.length !== 4 || parts[0] !== TOKEN_PREFIX || parts[1] !== TOKEN_VERSION) {
    return { ok: false, reason: 'malformed or unsupported license token' };
  }
  const [, , payloadSeg, sigSeg] = parts;
  const signingInput = `${TOKEN_PREFIX}.${TOKEN_VERSION}.${payloadSeg}`;

  // 1) Signature must verify against the trusted public key.
  let signatureOk: boolean;
  try {
    const key = opts.publicKey ?? decodeCanonicalKey(CANONICAL_PUBLIC_KEY_B64URL);
    signatureOk = edVerify(null, Buffer.from(signingInput, 'utf8'), key, Buffer.from(sigSeg, 'base64url'));
  } catch {
    signatureOk = false;
  }
  if (!signatureOk) return { ok: false, reason: 'license signature verification failed' };

  // 2) Payload must parse and carry a paid edition.
  let raw: RawPayload;
  try {
    raw = JSON.parse(Buffer.from(payloadSeg, 'base64url').toString('utf8')) as RawPayload;
  } catch {
    return { ok: false, reason: 'license payload is not valid JSON' };
  }
  if (raw.v !== 1) return { ok: false, reason: 'unsupported license payload version' };

  const edition = parseEdition(typeof raw.edition === 'string' ? raw.edition : undefined);
  if (edition === 'community') {
    return { ok: false, reason: 'license does not grant a paid edition' };
  }

  // 3) Expiry (null = perpetual). A missing/invalid iat is tolerated (→ 0).
  const expiresAt = raw.exp === null || raw.exp === undefined ? null : Number(raw.exp);
  if (expiresAt !== null && (!Number.isFinite(expiresAt) || opts.now >= expiresAt)) {
    return { ok: false, reason: 'license has expired' };
  }

  const features = Array.isArray(raw.features)
    ? (raw.features.filter((f): f is Feature => FEATURE_KEYS.includes(f as Feature)))
    : undefined;

  return {
    ok: true,
    claims: {
      edition,
      features,
      subject: typeof raw.sub === 'string' ? raw.sub : 'unknown',
      licenseId: typeof raw.lid === 'string' ? raw.lid : 'unknown',
      issuedAt: Number.isFinite(Number(raw.iat)) ? Number(raw.iat) : 0,
      expiresAt,
    },
  };
}

// Isolated so verify.ts stays pure/testable; callers normally pass an explicit `now`.
function nowMs(): number {
  return Date.now();
}
