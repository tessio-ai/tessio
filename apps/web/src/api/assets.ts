// SPDX-License-Identifier: AGPL-3.0-only

import { request } from './client';
import type { Page, AssetRow } from './types';

export interface AssetQuery {
  filter?: unknown;
  sort?: { field: string; dir: 'asc' | 'desc' };
  limit?: number;
  cursor?: string;
}

export interface CreateAssetInput {
  schemaId: string;
  schemaVersion: number;
  assetTag?: string;
  serial?: string;
  status?: 'in_use' | 'in_stock' | 'retired';
  ownerId?: string;
  location?: string;
  warrantyExpiresAt?: string;
  data?: Record<string, unknown>;
}

export type UpdateAssetInput = Partial<Omit<CreateAssetInput, 'schemaId' | 'schemaVersion'>>;

export const queryAssets = (q: AssetQuery = {}): Promise<Page<AssetRow>> =>
  request<Page<AssetRow>>('/assets/query', { method: 'POST', body: JSON.stringify(q) });

export const getAsset = (id: string): Promise<AssetRow> => request<AssetRow>(`/assets/${id}`);

export const createAsset = (b: CreateAssetInput): Promise<AssetRow> =>
  request<AssetRow>('/assets', { method: 'POST', body: JSON.stringify(b) });

export const updateAsset = (id: string, b: UpdateAssetInput): Promise<AssetRow> =>
  request<AssetRow>(`/assets/${id}`, { method: 'PATCH', body: JSON.stringify(b) });

export const deleteAsset = (id: string) => request<void>(`/assets/${id}`, { method: 'DELETE' });
