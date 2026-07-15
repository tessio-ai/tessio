// SPDX-License-Identifier: AGPL-3.0-only

/**
 * License signing — the PRIVATE-key half. This is vendor-only: it runs in the
 * license server (to mint short-TTL entitlement tokens on each check-in) and in
 * the offline CLI (to mint long-lived air-gap tokens). It never runs inside a
 * customer's Tessio instance, and the private key never lives in this repo.
 *
 * Signing code being public is fine — the security rests entirely on custody of
 * the private key, not on hiding the algorithm.
 */

import { sign as edSign } from 'node:crypto';
import { EDITIONS, type Edition, type Feature } from '@tessio/entitlements';
import { type LicensePayload, encodePayload, assembleToken } from './format';
import { privateKeyFromRaw } from './keys';

export interface IssueInput {
  /** Paid edition to grant. */
  edition: Edition;
  /** Who the license is for (org/company). */
  subject: string;
  /** Opaque license id (defaults to `lic_<iat>`). */
  licenseId?: string;
  /** Optional explicit feature subset. */
  features?: Feature[];
  /**
   * Total billable seats to grant (including the free allotment). `null` =
   * unlimited (site license). Omitted = no seat grant (free allotment only).
   */
  seats?: number | null;
  /** Lifetime in seconds; `null`/omitted = perpetual (offline tokens only). */
  ttlSeconds?: number | null;
  /** Issued-at, unix seconds (injected for testability). */
  now: number;
}

/**
 * Mint a signed token. `privateKeyB64url` is the raw Ed25519 seed the vendor
 * keeps in a secret store. Throws on a non-paid edition — community needs no token.
 */
export function signLicense(input: IssueInput, privateKeyB64url: string): string {
  if (!EDITIONS.includes(input.edition) || input.edition === 'community') {
    throw new Error(`edition must be a paid edition (${EDITIONS.filter((e) => e !== 'community').join(' | ')})`);
  }
  if (input.seats !== undefined && input.seats !== null && (!Number.isInteger(input.seats) || input.seats <= 0)) {
    throw new Error('seats must be a positive integer, or null for unlimited');
  }
  // Guard the falsy-zero trap: ttlSeconds 0/negative/NaN must never silently
  // become "perpetual" — only an explicit null/undefined means no expiry.
  if (input.ttlSeconds !== undefined && input.ttlSeconds !== null && (!Number.isFinite(input.ttlSeconds) || input.ttlSeconds <= 0)) {
    throw new Error('ttlSeconds must be a positive number, or null/omitted for perpetual');
  }
  const payload: LicensePayload = {
    v: 1,
    edition: input.edition,
    sub: input.subject,
    lid: input.licenseId ?? `lic_${input.now}`,
    iat: input.now,
    exp: input.ttlSeconds != null ? input.now + Math.round(input.ttlSeconds) : null,
    ...(input.features && input.features.length ? { features: input.features } : {}),
    ...(input.seats !== undefined ? { seats: input.seats } : {}),
  };

  const payloadSeg = encodePayload(payload);
  const signingInput = `tessio-lic.v1.${payloadSeg}`;
  const sig = edSign(null, Buffer.from(signingInput, 'utf8'), privateKeyFromRaw(privateKeyB64url)).toString('base64url');
  return assembleToken(payloadSeg, sig);
}
