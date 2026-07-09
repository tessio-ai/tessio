// SPDX-License-Identifier: AGPL-3.0-only

import { statusTimestamps } from '@tessio/shared';
import { diffTicketActivity } from '@tessio/db';

export interface TicketActionDeps {
  getTicket(ticketId: string): Promise<Record<string, unknown> | undefined>;
  patchTicket(ticketId: string, patch: Record<string, unknown>): Promise<Record<string, unknown> | undefined>;
  /** actor is the workflow → actorId null; rendered as a system event in the timeline. */
  recordActivity(event: { ticketId: string; eventType: string; changes?: Record<string, unknown> }): Promise<void>;
}

/**
 * The engine's update_ticket side effect: merge `data` patches into the existing
 * JSONB, stamp resolved/closed on status transitions (same rule as the API), and
 * record the same activity diff events the API write path records. The worker
 * never publishes workflow events for these, so workflows cannot re-trigger
 * workflows (v1 loop guard, see design doc).
 */
export async function applyTicketUpdate(
  deps: TicketActionDeps,
  ticketId: string,
  set: { status?: string; priority?: string; assigneeId?: string; teamId?: string; parentId?: string; data?: Record<string, unknown> },
): Promise<{ ticket: Record<string, unknown>; updated: string[] }> {
  const before = await deps.getTicket(ticketId);
  if (!before) throw new Error(`Ticket ${ticketId} not found.`);

  // Same guard the API write path enforces (the resource layer is bypassed here).
  if (set.parentId != null && set.parentId === ticketId) throw new Error('A ticket cannot be its own parent.');

  const patch: Record<string, unknown> = { ...set };
  if (set.data) patch.data = { ...((before.data ?? {}) as Record<string, unknown>), ...set.data };
  if (set.status !== undefined) Object.assign(patch, statusTimestamps(before.status, set.status, new Date()));

  const after = await deps.patchTicket(ticketId, patch);
  if (!after) throw new Error(`Ticket ${ticketId} disappeared during update.`);

  const events = diffTicketActivity(before, after);
  for (const e of events) {
    await deps.recordActivity({ ticketId, eventType: e.eventType, changes: e.changes });
  }
  return { ticket: after, updated: Object.keys(set) };
}
