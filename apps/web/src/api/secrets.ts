// SPDX-License-Identifier: AGPL-3.0-only

import { request } from './client';

export interface SecretSummary {
  name: string;
  hint: string;
  updatedAt: string;
  updatedBy: string | null;
}

export const listSecrets = () => request<SecretSummary[]>('/secrets');
export const createSecret = (name: string, value: string) =>
  request<SecretSummary>('/secrets', { method: 'POST', body: JSON.stringify({ name, value }) });
export const replaceSecret = (name: string, value: string) =>
  request<SecretSummary>(`/secrets/${name}`, { method: 'PUT', body: JSON.stringify({ value }) });
export const deleteSecret = (name: string) =>
  request<void>(`/secrets/${name}`, { method: 'DELETE' });
