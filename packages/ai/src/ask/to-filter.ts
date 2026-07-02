// SPDX-License-Identifier: AGPL-3.0-only

import type { FilterNode, FilterLeaf } from '@tessio/shared';
import type { AskPlan } from './schema';

/** Curated ticket columns the model may filter on (drizzle property names). */
export const ALLOWED_ASK_FIELDS = [
  'status', 'priority', 'assigneeId', 'teamId', 'requesterId',
  'number', 'createdAt', 'updatedAt', 'dueAt', 'resolvedAt', 'closedAt',
] as const;

const DATA_FIELD_RE = /^data\.[a-zA-Z0-9_]+$/;
const MAX_CONDITIONS = 8;

function fieldAllowed(field: string): boolean {
  return (ALLOWED_ASK_FIELDS as readonly string[]).includes(field) || DATA_FIELD_RE.test(field);
}

/**
 * Convert a flat AskPlan into a one-level FilterNode, validating every field
 * against the whitelist. Unknown/unsafe fields are dropped. Returns `{ filter: null }`
 * when the plan isn't answerable or yields no valid conditions.
 */
export function planToFilter(plan: AskPlan): { filter: FilterNode | null } {
  if (!plan.answerable) return { filter: null };
  const leaves: FilterLeaf[] = [];
  for (const c of plan.conditions.slice(0, MAX_CONDITIONS)) {
    let field = c.field;
    let op = c.op;
    if (field === 'unassigned') {
      field = 'assigneeId';
      op = 'isNull';
    }
    if (!fieldAllowed(field)) continue;
    if (op === 'isNull') {
      leaves.push({ field, op: 'isNull' });
      continue;
    }
    if (op === 'in') {
      if (c.value.length === 0) continue;
      leaves.push({ field, op: 'in', value: c.value });
      continue;
    }
    const v = c.value[0];
    if (v === undefined) continue;
    leaves.push({ field, op, value: v });
  }
  if (leaves.length === 0) return { filter: null };
  return { filter: plan.combine === 'or' ? { or: leaves } : { and: leaves } };
}
