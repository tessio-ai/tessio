// SPDX-License-Identifier: AGPL-3.0-only

/* Pure helpers for the requester "ticket progress" view. */
import type { ActivityRow } from '../../api/activity';
import type { CommentRow } from '../../api/types';

/** The requester-facing journey stages, in order. */
export const PROGRESS_STEPS = ['Submitted', 'In progress', 'Resolved', 'Closed'] as const;

const STEP_BY_STATUS: Record<string, number> = {
  new: 0,
  open: 0,
  in_progress: 1,
  pending: 1,
  on_hold: 1,
  resolved: 2,
  closed: 3,
};

/**
 * Map a ticket status to the furthest journey stage reached (index into PROGRESS_STEPS).
 * Unknown custom statuses read as "In progress" — the ticket exists and isn't finished.
 */
export function progressStep(status: string | null | undefined): number {
  if (!status) return 0;
  return STEP_BY_STATUS[status] ?? 1;
}

/** Human label for a raw status value ("in_progress" → "In progress"). */
export function statusLabel(status: string | null | undefined): string {
  const s = (status || 'open').replace(/[_-]+/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export type TimelineEntry =
  | { kind: 'created'; id: string; at: string }
  | { kind: 'status'; id: string; at: string; to: string | null }
  | { kind: 'comment'; id: string; at: string; authorId: string | null; body: string };

/**
 * Merge activity events and public comments into one chronological timeline.
 * Only requester-relevant events are kept: creation and status changes — internal
 * operations (assignment, priority, team, field edits) stay out of the portal.
 */
export function buildTimeline(activity: ActivityRow[], comments: CommentRow[]): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  for (const a of activity) {
    if (a.eventType === 'created') entries.push({ kind: 'created', id: a.id, at: a.createdAt });
    else if (a.eventType === 'status') entries.push({ kind: 'status', id: a.id, at: a.createdAt, to: typeof a.changes?.to === 'string' ? a.changes.to : null });
  }
  for (const c of comments) {
    if (!c.internal) entries.push({ kind: 'comment', id: c.id, at: c.createdAt, authorId: c.authorId, body: c.body });
  }
  return entries.sort((x, y) => Date.parse(x.at) - Date.parse(y.at));
}
