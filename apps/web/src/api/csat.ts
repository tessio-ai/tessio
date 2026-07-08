// SPDX-License-Identifier: AGPL-3.0-only

import { request } from './client';

export interface CsatSettingsView {
  enabled: boolean;
  question: string | null;
}

export interface UpdateCsatSettingsInput {
  enabled?: boolean;
  question?: string;
}

export interface CsatResponseView {
  ticketId: string;
  rating: number | null;
  comment: string | null;
  sentAt: string;
  respondedAt: string | null;
}

export interface MyCsatView {
  enabled: boolean;
  question: string | null;
  responses: CsatResponseView[];
}

// Admin settings
export const getCsatSettings = () => request<CsatSettingsView>('/csat-settings');
export const putCsatSettings = (body: UpdateCsatSettingsInput) =>
  request<CsatSettingsView>('/csat-settings', { method: 'PUT', body: JSON.stringify(body) });

// Requester portal
export const getMyCsat = () => request<MyCsatView>('/portal/csat');
export const submitCsat = (ticketId: string, rating: number, comment?: string) =>
  request<CsatResponseView>(`/portal/tickets/${ticketId}/csat`, {
    method: 'POST',
    body: JSON.stringify({ rating, ...(comment?.trim() ? { comment: comment.trim() } : {}) }),
  });

// Staff (agent console)
export const getTicketCsat = (ticketId: string) =>
  request<{ survey: CsatResponseView | null }>(`/tickets/${ticketId}/csat`);
