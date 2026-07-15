// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Central entitlements / feature-flag layer for Tessio's open-core model.
 *
 * This is the single source of truth for "which features are enabled" and "how
 * many billable seats this instance may use", based on the active edition. It is
 * core (AGPL) code: it knows the *names* of the paid features so the Community
 * build can keep them switched off, but it contains none of their implementation
 * — that lives in `ee/`.
 *
 * Invariants:
 *   - Every edition includes FREE_SEAT_LIMIT billable seats (admins + agents)
 *     for free. A paid license raises the limit to the purchased seat count
 *     (or removes it for site licenses). Requesters are never billable and are
 *     always unlimited.
 *   - The Community edition enables NO enterprise features.
 *   - "reserved" features are planned but not implemented yet; they report
 *     disabled in every edition until their implementation lands and they are
 *     flipped to "available".
 *   - Licensed seat counts are only trusted after boot-time verification of a
 *     signed license token (see @tessio/license). `TESSIO_LICENSED_SEATS` is
 *     written by `applyResolvedEdition` AFTER verification, exactly like
 *     `TESSIO_EDITION` — a hand-set value is overwritten before anything reads it.
 */

export type { AuditEntry, EnterpriseContext, EnterprisePlugin } from './contract';

export type Edition = 'community' | 'enterprise' | 'cloud';

export const EDITIONS: readonly Edition[] = ['community', 'enterprise', 'cloud'];

/**
 * Billable seats included free in every edition. Beyond this, adding an active
 * admin or agent requires a paid per-seat subscription (a signed license whose
 * `seats` claim covers the new total).
 */
export const FREE_SEAT_LIMIT = 5;

// Billable-role list lives in @tessio/shared (the dependency-free bottom
// layer) so the DB count query and this policy layer share one definition.
export { BILLABLE_ROLES, isBillableRole, type BillableRole } from '@tessio/shared';

/** Gateable enterprise features. Core ITSM features are NOT listed here — they
 * are always on in every edition and are never gated. */
export type Feature = 'sso' | 'audit_log' | 'scim' | 'custom_roles' | 'advanced_sla';

export interface FeatureSpec {
  /** Human-readable label, surfaced in the License settings UI. */
  label: string;
  /** Editions entitled to the feature. */
  editions: readonly Edition[];
  /**
   * `available` — implemented and gateable today.
   * `reserved`  — a paid feature we've reserved the key for but have not built
   *               yet; always reports disabled until implemented.
   */
  status: 'available' | 'reserved';
}

/** Editions that carry the paid feature set. */
const PAID: readonly Edition[] = ['enterprise', 'cloud'];

/**
 * The feature catalog. SSO and the audit-log viewer are extracted into `ee/`
 * and available now; the rest are reserved keys for future `ee/` work
 * (they do not exist in the codebase yet — see LICENSING.md).
 */
export const FEATURES: Record<Feature, FeatureSpec> = {
  sso: { label: 'Single sign-on (OIDC)', editions: PAID, status: 'available' },
  audit_log: { label: 'Audit log', editions: PAID, status: 'available' },
  scim: { label: 'SCIM provisioning', editions: PAID, status: 'reserved' },
  custom_roles: { label: 'Custom roles & advanced RBAC', editions: PAID, status: 'reserved' },
  advanced_sla: { label: 'Advanced SLA policies', editions: PAID, status: 'reserved' },
};

export const FEATURE_KEYS = Object.keys(FEATURES) as Feature[];

/** Coerce an arbitrary string into a known edition, defaulting to community. */
export function parseEdition(value: string | null | undefined): Edition {
  return EDITIONS.includes(value as Edition) ? (value as Edition) : 'community';
}

/** Browser-safe read of the TESSIO_EDITION env var (undefined off-Node). */
function editionFromEnv(): string | undefined {
  return typeof process !== 'undefined' ? process.env?.TESSIO_EDITION : undefined;
}

/**
 * The active edition. Defaults to the value of `TESSIO_EDITION` (community when
 * unset/invalid). Pass an explicit value to override (e.g. in tests).
 */
export function getEdition(value: string | undefined = editionFromEnv()): Edition {
  return parseEdition(value);
}

/** Whether a single feature is enabled for the given (or active) edition. */
export function isFeatureEnabled(feature: Feature, edition: Edition = getEdition()): boolean {
  const spec = FEATURES[feature];
  return spec.status === 'available' && spec.editions.includes(edition);
}

/**
 * Licensed seats granted by a verified license token:
 *   number      — the purchased seat total,
 *   null        — unlimited (site license),
 *   undefined   — no seat grant present.
 */
export type LicensedSeats = number | null | undefined;

/**
 * The one seats grammar, shared by every entry point that reads a seat count
 * from a string (the TESSIO_LICENSED_SEATS carrier, Stripe `tessio_seats`
 * metadata, the license CLI's --seats flag): 'unlimited' → null (site
 * license), a positive integer → that count, anything else → undefined (no
 * grant — fail toward the free allotment, never toward unlimited).
 */
export function parseSeats(raw: string | undefined | null): LicensedSeats {
  if (raw === undefined || raw === null || raw === '') return undefined;
  if (raw === 'unlimited') return null;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

/**
 * Browser-safe read of `TESSIO_LICENSED_SEATS` — written by
 * `applyResolvedEdition` after signature verification, never set by hand.
 */
function licensedSeatsFromEnv(): LicensedSeats {
  return parseSeats(typeof process !== 'undefined' ? process.env?.TESSIO_LICENSED_SEATS : undefined);
}

/**
 * The billable-seat limit for an edition. Community always gets exactly the
 * free allotment; a paid edition gets whatever its verified license grants
 * (falling back to the free allotment if a paid token somehow carries no seat
 * grant — fail toward the free tier, never toward unlimited).
 */
export function getSeatLimit(
  edition: Edition = getEdition(),
  licensedSeats: LicensedSeats = licensedSeatsFromEnv(),
): number | null {
  if (edition === 'community') return FREE_SEAT_LIMIT;
  if (licensedSeats === null) return null; // explicit unlimited / site license
  if (typeof licensedSeats === 'number') return Math.max(licensedSeats, FREE_SEAT_LIMIT);
  return FREE_SEAT_LIMIT;
}

export interface Entitlements {
  edition: Edition;
  /** Per-feature enabled map. */
  features: Record<Feature, boolean>;
  /**
   * Maximum active billable seats (admins + agents). `null` = unlimited (site
   * license). Every edition includes FREE_SEAT_LIMIT seats free; a paid
   * per-seat license raises this. Requesters are never counted.
   */
  seatLimit: number | null;
}

/** A full entitlements snapshot for the given (or active) edition. */
export function getEntitlements(
  edition: Edition = getEdition(),
  licensedSeats: LicensedSeats = licensedSeatsFromEnv(),
): Entitlements {
  const features = Object.fromEntries(
    FEATURE_KEYS.map((f) => [f, isFeatureEnabled(f, edition)]),
  ) as Record<Feature, boolean>;
  return { edition, features, seatLimit: getSeatLimit(edition, licensedSeats) };
}
