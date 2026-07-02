// SPDX-License-Identifier: AGPL-3.0-only

import { request } from './client';
import type { Page, TicketRow } from './types';

export interface TicketQuery {
  filter?: unknown;
  sort?: { field: string; dir: 'asc' | 'desc'; type?: 'text' | 'number' | 'boolean' | 'date' };
  limit?: number;
  cursor?: string;
}
export interface CreateTicketInput {
  schemaId: string;
  schemaVersion: number;
  status?: string;
  priority?: string;
  requesterId?: string;
  assigneeId?: string;
  dueAt?: string;
  data?: Record<string, unknown>;
}
export type UpdateTicketInput =
  // Omit the nullable fields from the base so the intersection doesn't cancel `null` back out.
  Partial<Omit<CreateTicketInput, 'schemaId' | 'schemaVersion' | 'assigneeId' | 'dueAt' | 'teamId'>> & {
    // Nullable fields can be cleared by sending null (assignee / due / team).
    assigneeId?: string | null;
    dueAt?: string | null;
    teamId?: string | null;
  };

export const queryTickets = (q: TicketQuery = {}): Promise<Page<TicketRow>> =>
  request<Page<TicketRow>>('/tickets/query', { method: 'POST', body: JSON.stringify(q) });
export const getTicket = (id: string): Promise<TicketRow> => request<TicketRow>(`/tickets/${id}`);
export const createTicket = (b: CreateTicketInput): Promise<TicketRow> =>
  request<TicketRow>('/tickets', { method: 'POST', body: JSON.stringify(b) });
export const updateTicket = (id: string, b: UpdateTicketInput): Promise<TicketRow> =>
  request<TicketRow>(`/tickets/${id}`, { method: 'PATCH', body: JSON.stringify(b) });
export const deleteTicket = (id: string) => request<void>(`/tickets/${id}`, { method: 'DELETE' });
