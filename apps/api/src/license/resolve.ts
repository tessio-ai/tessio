// SPDX-License-Identifier: AGPL-3.0-only

/**
 * The composition-root seam that makes `@tessio/entitlements` authoritative.
 *
 * `getEdition()` reads `TESSIO_EDITION` and trusts it. That is fine for a value
 * that has already been *earned* — so the boot sequence resolves the effective
 * edition here first, verifying a signed license before it lets any paid edition
 * stand, and fails closed to Community otherwise. index.ts calls this and writes
 * the result back to `process.env.TESSIO_EDITION` BEFORE anything (the ee/ loader,
 * `getEntitlements`, the `requireFeature` guards) reads it, so the whole process
 * runs at the verified edition and the entitlements package stays the single
 * source of truth — it just now reflects a value that was checked, not asserted.
 *
 * Community requires no license and is never downgraded. Only a request for a
 * paid edition triggers verification.
 */

import { parseEdition, type Edition } from '@tessio/entitlements';
import { verifyLicenseKey, type LicenseClaims } from './verify';

export interface ResolvedEdition {
  /** The edition to actually run at (already coerced/validated). */
  edition: Edition;
  /** Verified license claims when a paid edition is active, else null. */
  license: LicenseClaims | null;
  /** True when a paid edition was requested but denied and we fell back to community. */
  downgraded: boolean;
  /** Human-readable reason for a downgrade (for logs), else null. */
  reason: string | null;
}

export interface ResolveInput {
  /** Raw requested edition, e.g. process.env.TESSIO_EDITION. */
  requestedEdition: string | undefined;
  /** Raw license token, e.g. process.env.TESSIO_LICENSE_KEY. */
  licenseKey: string | undefined;
  /** Current time, unix seconds (injected for tests). */
  now: number;
}

/**
 * Resolve the edition the process may actually run at.
 *
 * Fail-closed contract: any missing/invalid/expired/mismatched license makes a
 * paid request collapse to `community`. The license's own edition wins over the
 * requested one, so a `cloud` env var with an `enterprise` license runs
 * enterprise (you get what you paid for, not what you asked for).
 */
export function resolveEffectiveEdition(input: ResolveInput): ResolvedEdition {
  const requested = parseEdition(input.requestedEdition);

  // Community is the floor and needs no license.
  if (requested === 'community') {
    return { edition: 'community', license: null, downgraded: false, reason: null };
  }

  const result = verifyLicenseKey(input.licenseKey, { now: input.now });
  if (!result.ok) {
    return { edition: 'community', license: null, downgraded: true, reason: result.reason };
  }

  // Trust the license's edition, not the env var.
  return { edition: result.claims.edition, license: result.claims, downgraded: false, reason: null };
}

/**
 * Apply a resolved edition to the environment so the rest of the process
 * (entitlements, ee/ loader, feature guards) observes the verified value.
 * Returns the same resolution for logging.
 */
export function applyResolvedEdition(
  input: ResolveInput,
  env: NodeJS.ProcessEnv = process.env,
): ResolvedEdition {
  const resolved = resolveEffectiveEdition(input);
  env.TESSIO_EDITION = resolved.edition;
  return resolved;
}
