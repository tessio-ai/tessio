// SPDX-License-Identifier: AGPL-3.0-only

import { request } from './client';
import type { SchemaDefinition } from '@tessio/shared';
import type { SchemaRow } from './types';

export interface ListSchemasParams {
  kind?: 'ticket' | 'asset' | 'kb_article' | 'form';
  status?: 'draft' | 'published' | 'archived';
}

/** List record-type definitions, optionally filtered by kind/status. */
export function listSchemas(params: ListSchemasParams = {}): Promise<SchemaRow[]> {
  const qs = new URLSearchParams();
  if (params.kind) qs.set('kind', params.kind);
  if (params.status) qs.set('status', params.status);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return request<SchemaRow[]>(`/schemas${suffix}`);
}

export interface CreateSchemaInput {
  name: string;
  key?: string;
  kind?: 'ticket' | 'asset';
  definition?: SchemaDefinition;
}

export const createSchema = (b: CreateSchemaInput) => request<SchemaRow>('/schemas', { method: 'POST', body: JSON.stringify(b) });
export const getSchema = (id: string) => request<SchemaRow>(`/schemas/${id}`);
export const updateSchema = (id: string, patch: { definition?: SchemaDefinition; name?: string; key?: string }) =>
  request<SchemaRow>(`/schemas/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
