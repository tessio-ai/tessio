// SPDX-License-Identifier: AGPL-3.0-only

import { planToFilter, type AskPlan, type CompactTicket } from '@tessio/ai';
import type { FilterNode } from '@tessio/shared';

export interface AskTicketRow {
  id: string;
  number: number | null;
  status: string | null;
  priority: string | null;
  assigneeId: string | null;
  dueAt: string | Date | null;
  data: Record<string, unknown>;
}

export interface AskResult {
  answer: string;
  tickets: { number: number | null; id: string; title: string; status: string | null }[];
}

export interface AskDeps {
  plan: (query: string, now: string) => Promise<AskPlan>;
  queryTickets: (filter: FilterNode, limit: number) => Promise<AskTicketRow[]>;
  answer: (query: string, tickets: CompactTicket[]) => Promise<string>;
}

const MAX_ROWS = 50;
const HINT = 'I can search and summarize your tickets — try asking about status, priority, assignee, SLA/due date, or category.';

const titleOf = (r: AskTicketRow): string => (r.data?.title as string) ?? 'Untitled';

export async function runAsk(deps: AskDeps, input: { query: string }): Promise<AskResult> {
  const now = new Date().toISOString();
  const plan = await deps.plan(input.query, now);
  const { filter } = planToFilter(plan);
  if (!plan.answerable || !filter) return { answer: HINT, tickets: [] };

  const limit = Math.min(Math.max(Math.round(plan.limit || 20), 1), MAX_ROWS);
  const rows = await deps.queryTickets(filter, limit);
  const tickets = rows.map((r) => ({ number: r.number, id: r.id, title: titleOf(r), status: r.status }));

  if (rows.length === 0) return { answer: `I didn't find any tickets matching "${plan.title.slice(0, 120)}".`, tickets };

  const compact: CompactTicket[] = rows.map((r) => ({
    number: r.number,
    title: titleOf(r),
    status: r.status,
    priority: r.priority,
    assigned: !!r.assigneeId,
    dueAt: r.dueAt ? (r.dueAt instanceof Date ? r.dueAt.toISOString() : r.dueAt) : null,
    category: (r.data?.category as string) ?? null,
  }));
  const answer = await deps.answer(input.query, compact);
  return { answer, tickets };
}
