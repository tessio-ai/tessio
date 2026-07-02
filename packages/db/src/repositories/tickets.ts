// SPDX-License-Identifier: AGPL-3.0-only

import { and, eq, isNull, or, lt } from 'drizzle-orm';
import { tickets } from '../schema';
import { createRecordRepository } from './records';
import { assignNextNumber } from './counters';
import type { Db } from '../client';

type TicketInsert = typeof tickets.$inferInsert;

/**
 * Tickets repository: the generic record repo plus per-org `number` assignment
 * on create. `number` is allocated atomically and must not be passed in by callers.
 */
export function ticketsRepo(db: Db) {
  const base = createRecordRepository(db, tickets);
  return {
    ...base,
    async create(values: Omit<TicketInsert, 'number'>) {
      const number = await assignNextNumber(db, values.orgId, 'ticket');
      return base.create({ ...values, number });
    },
    /** Look up a ticket by its org-scoped human-readable number. Returns undefined if not found. */
    async getByNumber(orgId: string, number: number) {
      const rows = await db
        .select()
        .from(tickets)
        .where(and(eq(tickets.orgId, orgId), eq(tickets.number, number), isNull(tickets.deletedAt)));
      return rows[0];
    },
    async setSlaTargets(orgId: string, ticketId: string, due: { responseDueAt: Date | null; resolutionDueAt: Date | null }) {
      await db.update(tickets).set({ slaResponseDueAt: due.responseDueAt, slaResolutionDueAt: due.resolutionDueAt })
        .where(and(eq(tickets.orgId, orgId), eq(tickets.id, ticketId)));
    },
    async markFirstResponded(orgId: string, ticketId: string, at: Date) {
      await db.update(tickets).set({ firstRespondedAt: at })
        .where(and(eq(tickets.orgId, orgId), eq(tickets.id, ticketId), isNull(tickets.firstRespondedAt)));
    },
    async listSlaBreachCandidates(now: Date) {
      return db.select({
        id: tickets.id, orgId: tickets.orgId, number: tickets.number, assigneeId: tickets.assigneeId, teamId: tickets.teamId,
        slaResponseDueAt: tickets.slaResponseDueAt, firstRespondedAt: tickets.firstRespondedAt, slaResponseBreachedAt: tickets.slaResponseBreachedAt,
        slaResolutionDueAt: tickets.slaResolutionDueAt, resolvedAt: tickets.resolvedAt, slaResolutionBreachedAt: tickets.slaResolutionBreachedAt,
      }).from(tickets).where(and(isNull(tickets.deletedAt), or(
        and(lt(tickets.slaResponseDueAt, now), isNull(tickets.firstRespondedAt), isNull(tickets.slaResponseBreachedAt)),
        and(lt(tickets.slaResolutionDueAt, now), isNull(tickets.resolvedAt), isNull(tickets.slaResolutionBreachedAt)),
      )));
    },
    async stampSlaBreach(ticketId: string, kind: 'response' | 'resolution', at: Date) {
      const col = kind === 'response' ? { slaResponseBreachedAt: at } : { slaResolutionBreachedAt: at };
      await db.update(tickets).set(col).where(eq(tickets.id, ticketId));
    },
  };
}

/** Tracked system fields and the activity event type each one emits when changed. */
const TRACKED_TICKET_FIELDS: Record<string, string> = {
  status: 'status',
  assigneeId: 'assigned',
  priority: 'priority',
  teamId: 'team',
};

/**
 * Diff a ticket update into the activity events it should record — system fields
 * (status/assignee/priority/team) plus custom `data.*` field changes. Shared by the
 * API write path and the workflow engine's update_ticket action so the two cannot
 * drift (same timeline rendering, same trigger semantics).
 */
export function diffTicketActivity(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): { eventType: string; changes: Record<string, unknown> }[] {
  const events: { eventType: string; changes: Record<string, unknown> }[] = [];
  for (const [field, eventType] of Object.entries(TRACKED_TICKET_FIELDS)) {
    if (before[field] !== after[field]) {
      events.push({ eventType, changes: { from: before[field] ?? null, to: after[field] ?? null } });
    }
  }
  const oldData = (before.data ?? {}) as Record<string, unknown>;
  const newData = (after.data ?? {}) as Record<string, unknown>;
  for (const key of new Set([...Object.keys(oldData), ...Object.keys(newData)])) {
    if (oldData[key] !== newData[key]) {
      events.push({ eventType: 'field_changed', changes: { field: key, from: oldData[key] ?? null, to: newData[key] ?? null } });
    }
  }
  return events;
}
