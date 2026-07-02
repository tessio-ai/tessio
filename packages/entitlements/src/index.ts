// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Central entitlements / feature-flag layer for Tessio's open-core model.
 *
 * This is the single source of truth for "which features are enabled" based on
 * the active edition. It is core (AGPL) code: it knows the *names* of the paid
 * features so the Community build can keep them switched off, but it contains
 * none of their implementation — that lives in `ee/`.
 *
 * Invariants:
 *   - Gate on FEATURES, never on seat/agent count. Every edition ships with
 *     unlimited agents (`maxAgents: null`). There is deliberately no seat cap
 *     anywhere in this layer.
 *   - The Community edition enables NO enterprise features.
 *   - "reserved" features are planned but not implemented yet; they report
 *     disabled in every edition until their implementation lands and they are
 *     flipped to "available".
 */

export type { AuditEntry, EnterpriseContext, EnterprisePlugin } from './contract';

export type Edition = 'community' | 'enterprise' | 'cloud';

export const EDITIONS: readonly Edition[] = ['community', 'enterprise', 'cloud'];

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

export interface Entitlements {
  edition: Edition;
  /** Per-feature enabled map. */
  features: Record<Feature, boolean>;
  /** Maximum agents/seats. `null` means unlimited — Tessio never caps seats. */
  maxAgents: number | null;
}

/** A full entitlements snapshot for the given (or active) edition. */
export function getEntitlements(edition: Edition = getEdition()): Entitlements {
  const features = Object.fromEntries(
    FEATURE_KEYS.map((f) => [f, isFeatureEnabled(f, edition)]),
  ) as Record<Feature, boolean>;
  return { edition, features, maxAgents: null };
}
