// SPDX-License-Identifier: AGPL-3.0-only

import { request } from './client';
import type { CommentRow } from './types';

export interface AddCommentInput {
  body: string;
  internal?: boolean;
}

export const listAssetComments = (id: string): Promise<CommentRow[]> =>
  request<CommentRow[]>(`/assets/${id}/comments`);

export const addAssetComment = (id: string, b: AddCommentInput): Promise<CommentRow> =>
  request<CommentRow>(`/assets/${id}/comments`, { method: 'POST', body: JSON.stringify(b) });

export const listTicketComments = (id: string): Promise<CommentRow[]> =>
  request<CommentRow[]>(`/tickets/${id}/comments`);

export const addTicketComment = (id: string, b: AddCommentInput): Promise<CommentRow> =>
  request<CommentRow>(`/tickets/${id}/comments`, { method: 'POST', body: JSON.stringify(b) });
