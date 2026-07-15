// SPDX-License-Identifier: AGPL-3.0-only

/**
 * The composition-root seam that makes `@tessio/entitlements` authoritative.
 *
 * `getEdition()` reads `TESSIO_EDITION` and trusts it — fine for a value that has
 * already been *earned*. The boot sequence resolves the effective edition here
 * first, from a cryptographically-verified token, and fails closed to Community
 * otherwise. index.ts applies the result to `process.env.TESSIO_EDITION` BEFORE
 * anything (the ee/ loader, `getEntitlements`, the `requireFeature` guards) reads
 * it, so the whole process runs at the verified edition and the entitlements
 * package stays the single source of truth — now reflecting a checked value.
 *
 * The `signedToken` passed in is whatever the license client resolved to: a
 * fresh entitlement token from today's check-in, a cached one (offline grace),
 * or a long-lived offline air-gap token. This module does not care which — it
 * just verifies.
 */

import { parseEdition, type Edition } from '@tessio/entitlements';
import { verifyLicenseKey, type LicenseClaims } from './verify';
import type { KeyObject } from 'node:crypto';

export interface ResolvedEdition {
  edition: Edition;
  license: LicenseClaims | null;
  /** True when a paid edition was requested but denied → fell back to community. */
  downgraded: boolean;
  reason: string | null;
}

export interface ResolveInput {
  /** Raw requested edition, e.g. process.env.TESSIO_EDITION. */
  requestedEdition: string | undefined;
  /** A signed token to verify (from the license client), or undefined. */
  signedToken: string | undefined;
  /** Current time, unix seconds. */
  now: number;
  /** Override the verifying key (tests only). */
  publicKey?: KeyObject;
}

/**
 * Resolve the edition the process may actually run at. Fail-closed: any
 * missing/invalid/expired token makes a paid request collapse to `community`.
 * The token's own edition wins over the requested one.
 */
export function resolveEffectiveEdition(input: ResolveInput): ResolvedEdition {
  const requested = parseEdition(input.requestedEdition);
  if (requested === 'community') {
    return { edition: 'community', license: null, downgraded: false, reason: null };
  }

  const result = verifyLicenseKey(input.signedToken, { now: input.now, publicKey: input.publicKey });
  if (!result.ok) {
    return { edition: 'community', license: null, downgraded: true, reason: result.reason };
  }
  return { edition: result.claims.edition, license: result.claims, downgraded: false, reason: null };
}

/**
 * Apply a resolved edition to the environment so the rest of the process sees
 * it. `TESSIO_LICENSED_SEATS` is written (or cleared) here and ONLY here —
 * always after verification — so a hand-set value never survives boot. The
 * entitlements package turns it into the effective seat limit (community and
 * seat-less paid tokens stay at the free allotment).
 */
export function applyResolvedEdition(input: ResolveInput, env: NodeJS.ProcessEnv = process.env): ResolvedEdition {
  const resolved = resolveEffectiveEdition(input);
  env.TESSIO_EDITION = resolved.edition;
  const seats = resolved.license?.seats;
  if (seats === null) env.TESSIO_LICENSED_SEATS = 'unlimited';
  else if (typeof seats === 'number') env.TESSIO_LICENSED_SEATS = String(seats);
  else delete env.TESSIO_LICENSED_SEATS;
  return resolved;
}
