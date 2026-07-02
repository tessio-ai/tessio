// SPDX-License-Identifier: AGPL-3.0-only

/** Active (not-yet-finished) ticket statuses. Moving to one of these reopens the ticket. */
const ACTIVE_STATUSES = new Set(['open', 'new', 'in_progress', 'pending', 'on_hold']);

/**
 * Derive the `resolvedAt` / `closedAt` stamp changes for a status transition.
 * - entering `resolved` → set `resolvedAt = now`
 * - entering `closed`   → set `closedAt = now` (leave `resolvedAt` as-is)
 * - reopening to an active state → clear both stamps
 * - no status change (or no string status in the patch) → no change
 */
export function statusTimestamps(
  oldStatus: unknown,
  newStatus: unknown,
  now: Date,
): { resolvedAt?: Date | null; closedAt?: Date | null } {
  if (typeof newStatus !== 'string' || newStatus === oldStatus) return {};
  if (newStatus === 'resolved') return { resolvedAt: now };
  if (newStatus === 'closed') return { closedAt: now };
  if (ACTIVE_STATUSES.has(newStatus)) return { resolvedAt: null, closedAt: null };
  return {};
}
