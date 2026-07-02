// SPDX-License-Identifier: AGPL-3.0-only

import { request } from './client';
import type { Page, KbArticleRow } from './types';

export interface ArticleQuery {
  filter?: unknown;
  sort?: { field: string; dir: 'asc' | 'desc'; type?: 'text' | 'number' | 'boolean' | 'date' };
  limit?: number;
  cursor?: string;
}

export interface CreateArticleInput {
  schemaId: string;
  schemaVersion: number;
  title?: string;
  slug?: string;
  status?: 'draft' | 'published';
  publishedAt?: string;
  authorId?: string;
  data?: Record<string, unknown>;
}

export type UpdateArticleInput = Partial<Omit<CreateArticleInput, 'schemaId' | 'schemaVersion'>>;

export const queryArticles = (q: ArticleQuery = {}): Promise<Page<KbArticleRow>> =>
  request<Page<KbArticleRow>>('/kb-articles/query', { method: 'POST', body: JSON.stringify(q) });

export const getArticle = (id: string): Promise<KbArticleRow> => request<KbArticleRow>(`/kb-articles/${id}`);

export const createArticle = (b: CreateArticleInput): Promise<KbArticleRow> =>
  request<KbArticleRow>('/kb-articles', { method: 'POST', body: JSON.stringify(b) });

export const updateArticle = (id: string, b: UpdateArticleInput): Promise<KbArticleRow> =>
  request<KbArticleRow>(`/kb-articles/${id}`, { method: 'PATCH', body: JSON.stringify(b) });

export const deleteArticle = (id: string) => request<void>(`/kb-articles/${id}`, { method: 'DELETE' });

export interface RevisionSummary {
  id: string;
  version: number;
  title: string | null;
  authorId: string | null;
  createdAt: string;
}
export interface Revision {
  id: string;
  version: number;
  title: string | null;
  data: Record<string, unknown>;
  createdAt: string;
}

export const listRevisions = (id: string): Promise<RevisionSummary[]> => request<RevisionSummary[]>(`/kb-articles/${id}/revisions`);
export const getRevision = (id: string, revId: string): Promise<Revision> => request<Revision>(`/kb-articles/${id}/revisions/${revId}`);
export const restoreRevision = (id: string, revId: string): Promise<KbArticleRow> =>
  request<KbArticleRow>(`/kb-articles/${id}/revisions/${revId}/restore`, { method: 'POST' });
