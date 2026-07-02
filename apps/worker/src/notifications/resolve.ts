// SPDX-License-Identifier: AGPL-3.0-only

import type { NotificationType } from '@tessio/shared';

export interface ResolveInput {
  eventType: string;
  actorId: string | null;
  internal: boolean;
  requesterId: string | null;
  assigneeId: string | null;
  changes?: Record<string, unknown>;
}
export interface Recipient { userId: string; type: NotificationType; }

const STATUS_EVENTS = new Set(['status', 'status_changed', 'resolved', 'closed']);

export function resolveRecipients(input: ResolveInput): Recipient[] {
  const out: Recipient[] = [];
  const add = (userId: string | null, type: NotificationType) => {
    if (userId && userId !== input.actorId && !out.some((r) => r.userId === userId)) out.push({ userId, type });
  };

  if (input.eventType === 'commented') {
    // Internal notes go to the assignee only; public replies go to the "other side".
    if (input.internal) { add(input.assigneeId, 'reply'); return out; }
    if (input.actorId === input.requesterId) add(input.assigneeId, 'reply');
    else add(input.requesterId, 'reply');
    return out;
  }
  if (input.eventType === 'assigned' || (input.eventType === 'created' && input.assigneeId)) {
    add(input.assigneeId, 'assigned');
    return out;
  }
  if (STATUS_EVENTS.has(input.eventType)) {
    add(input.requesterId, 'status');
    return out;
  }
  return out;
}
