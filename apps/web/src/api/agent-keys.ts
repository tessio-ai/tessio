// SPDX-License-Identifier: AGPL-3.0-only

import { request } from './client';

export interface EnrollmentKey {
  id: string;
  label: string;
  hint: string;
  createdAt: string;
  revokedAt: string | null;
}

/** Returned only by create — includes the plaintext key exactly once. */
export interface CreatedEnrollmentKey extends EnrollmentKey {
  key: string;
}

export const listEnrollmentKeys = (): Promise<EnrollmentKey[]> => request<EnrollmentKey[]>('/agent/enrollment-keys');

export const createEnrollmentKey = (label?: string): Promise<CreatedEnrollmentKey> =>
  request<CreatedEnrollmentKey>('/agent/enrollment-keys', { method: 'POST', body: JSON.stringify({ label: label ?? '' }) });

export const revokeEnrollmentKey = (id: string): Promise<EnrollmentKey> =>
  request<EnrollmentKey>(`/agent/enrollment-keys/${id}/revoke`, { method: 'POST', body: JSON.stringify({}) });
