// SPDX-License-Identifier: AGPL-3.0-only

import { request } from './client';

export interface ActivityRow {
  id: string;
  actorId: string | null;
  eventType: string;
  changes?: { from?: unknown; to?: unknown; field?: string; rating?: number } | null;
  createdAt: string;
}

export const listTicketActivity = (id: string): Promise<ActivityRow[]> =>
  request<ActivityRow[]>(`/tickets/${id}/activity`);
