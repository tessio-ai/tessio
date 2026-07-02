// SPDX-License-Identifier: AGPL-3.0-only

import { request } from './client';
import type { LinkRow } from './types';

export type RecordKind = 'ticket' | 'asset' | 'kb_article' | 'form_submission';

export interface CreateLinkInput {
  toType: RecordKind;
  toId: string;
  relationshipType: string;
  metadata?: Record<string, unknown>;
}

export const listAssetLinks = (id: string): Promise<LinkRow[]> =>
  request<LinkRow[]>(`/assets/${id}/links`);

export const addAssetLink = (id: string, b: CreateLinkInput): Promise<LinkRow> =>
  request<LinkRow>(`/assets/${id}/links`, { method: 'POST', body: JSON.stringify(b) });

export const listTicketLinks = (id: string): Promise<LinkRow[]> =>
  request<LinkRow[]>(`/tickets/${id}/links`);

export const addTicketLink = (id: string, b: CreateLinkInput): Promise<LinkRow> =>
  request<LinkRow>(`/tickets/${id}/links`, { method: 'POST', body: JSON.stringify(b) });

export const deleteTicketLink = (ticketId: string, linkId: string): Promise<void> =>
  request<void>(`/tickets/${ticketId}/links/${linkId}`, { method: 'DELETE' });
