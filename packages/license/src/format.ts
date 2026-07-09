// SPDX-License-Identifier: AGPL-3.0-only

/**
 * The on-the-wire license token format — the ONE contract shared by the signer
 * (the vendor's license server / offline CLI) and the verifier (every running
 * Tessio instance). Keeping it in a single core package is what stops the two
 * independently-deployed sides from drifting apart.
 *
 * A token is a compact, JWT-shaped string:
 *     tessio-lic.v1.<base64url(payloadJSON)>.<base64url(ed25519 signature)>
 * The signature covers the ASCII bytes `tessio-lic.v1.<base64url(payload)>`.
 *
 * This module is pure (only `Buffer`), no crypto and no keys — so it is safe to
 * import from anywhere on the server.
 */

import type { Edition, Feature } from '@tessio/entitlements';

export const TOKEN_PREFIX = 'tessio-lic';
export const TOKEN_VERSION = 'v1';

/** The claims carried inside a token's payload segment. */
export interface LicensePayload {
  /** Payload schema version. */
  v: 1;
  /** Edition the token grants (always a paid edition; community needs no token). */
  edition: Edition;
  /** Optional explicit feature allow-list; when absent the edition's full set applies. */
  features?: Feature[];
  /** Who the license is issued to (org/company), for display + support. */
  sub: string;
  /** Opaque license id, for support lookups / the vendor's ledger. */
  lid: string;
  /** Issued-at, unix seconds. */
  iat: number;
  /** Expiry, unix seconds. `null` = perpetual (only used for offline air-gap tokens). */
  exp: number | null;
}

export interface ParsedToken {
  payloadSeg: string;
  sigSeg: string;
  /** The exact bytes the signature must cover. */
  signingInput: string;
}

/** True when a string is shaped like a signed token (cheap check, no crypto). */
export function isSignedToken(value: string | undefined | null): value is string {
  return typeof value === 'string' && value.startsWith(`${TOKEN_PREFIX}.${TOKEN_VERSION}.`);
}

/** Split + structurally validate a token. Returns null when malformed. */
export function parseToken(token: string): ParsedToken | null {
  const parts = token.trim().split('.');
  if (parts.length !== 4 || parts[0] !== TOKEN_PREFIX || parts[1] !== TOKEN_VERSION) return null;
  const [, , payloadSeg, sigSeg] = parts;
  if (!payloadSeg || !sigSeg) return null;
  return { payloadSeg, sigSeg, signingInput: `${TOKEN_PREFIX}.${TOKEN_VERSION}.${payloadSeg}` };
}

/** Encode a payload to its base64url segment. */
export function encodePayload(payload: LicensePayload): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

/** Decode a payload segment back to raw JSON (unvalidated). Throws on bad JSON. */
export function decodePayload(payloadSeg: string): unknown {
  return JSON.parse(Buffer.from(payloadSeg, 'base64url').toString('utf8'));
}

/** Assemble the final token string from its parts. */
export function assembleToken(payloadSeg: string, sigSeg: string): string {
  return `${TOKEN_PREFIX}.${TOKEN_VERSION}.${payloadSeg}.${sigSeg}`;
}
