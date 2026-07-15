// SPDX-License-Identifier: AGPL-3.0-only

/**
 * The single source of truth for which user roles occupy a billable seat.
 * Lives in @tessio/shared (the dependency-free bottom layer) so BOTH
 * @tessio/entitlements (seat-limit policy) and @tessio/db (the countBillable
 * query) consume the same list — a role added in one place cannot silently be
 * missed by the other.
 */

/** Roles that occupy a billable seat. Requesters are free and unlimited. */
export const BILLABLE_ROLES = ['admin', 'agent'] as const;
export type BillableRole = (typeof BILLABLE_ROLES)[number];

export function isBillableRole(role: string): role is BillableRole {
  return (BILLABLE_ROLES as readonly string[]).includes(role);
}
