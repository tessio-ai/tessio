// SPDX-License-Identifier: AGPL-3.0-only

import type { TicketRow } from '../../api/types';
import type { UserRow } from '../../api/users';

export interface DisplayUser { id: string; name: string; initials: string; color: string; role: string; }

export interface DisplayTicket {
  id: string; number: number; type: string; title: string; status: string; priority: string;
  requesterId: string | null; assigneeId: string | null; teamId: string | null;
  updatedAt: number; createdAt: number; dueAt: number | null;
  data: Record<string, string>;
  slaResponseDueAt: string | null;
  slaResolutionDueAt: string | null;
  firstRespondedAt: string | null;
  slaResponseBreachedAt: string | null;
  slaResolutionBreachedAt: string | null;
}

const PALETTE = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#ef4444', '#3b82f6', '#84cc16'];

export function toDisplayUser(u: UserRow): DisplayUser {
  const parts = u.name.trim().split(/\s+/);
  const initials = ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? parts[0]?.[1] ?? '')).toUpperCase() || '?';
  let h = 0;
  for (let i = 0; i < u.id.length; i++) h = (h * 31 + u.id.charCodeAt(i)) >>> 0;
  return { id: u.id, name: u.name, initials, color: PALETTE[h % PALETTE.length], role: u.role };
}

export function usersById(users: UserRow[] = []): Record<string, DisplayUser> {
  return Object.fromEntries(users.map((u) => [u.id, toDisplayUser(u)]));
}

const ms = (iso: string | null): number => (iso ? Date.parse(iso) : 0);

export function toDisplayTicket(row: TicketRow, typeKeyById: Record<string, string>): DisplayTicket {
  const data: Record<string, string> = {};
  for (const [k, v] of Object.entries(row.data ?? {})) data[k] = v == null ? '' : String(v);
  return {
    id: row.id,
    number: row.number ?? 0,
    type: typeKeyById[row.schemaId] ?? 'request',
    title: (row.data?.title as string) || `Ticket #${row.number ?? '—'}`,
    status: row.status ?? 'open',
    priority: row.priority ?? 'medium',
    requesterId: row.requesterId,
    assigneeId: row.assigneeId,
    teamId: row.teamId,
    updatedAt: ms(row.updatedAt),
    createdAt: ms(row.createdAt),
    dueAt: row.dueAt ? ms(row.dueAt) : null,
    data,
    slaResponseDueAt: row.slaResponseDueAt ?? null,
    slaResolutionDueAt: row.slaResolutionDueAt ?? null,
    firstRespondedAt: row.firstRespondedAt ?? null,
    slaResponseBreachedAt: row.slaResponseBreachedAt ?? null,
    slaResolutionBreachedAt: row.slaResolutionBreachedAt ?? null,
  };
}

const CLOSED = ['resolved', 'closed'];
export interface DisplaySavedView { id: string; name: string; filter: (t: DisplayTicket) => boolean; }

export function savedViews(me: string | null): DisplaySavedView[] {
  return [
    { id: 'all', name: 'All', filter: () => true },
    { id: 'my_open', name: 'My open', filter: (t) => !!me && t.assigneeId === me && !CLOSED.includes(t.status) },
    { id: 'unassigned', name: 'Unassigned', filter: (t) => !t.assigneeId && !CLOSED.includes(t.status) },
    { id: 'breaching', name: 'Breaching', filter: (t) => !!t.slaResolutionDueAt && new Date(t.slaResolutionDueAt).getTime() < Date.now() && !CLOSED.includes(t.status) },
  ];
}
