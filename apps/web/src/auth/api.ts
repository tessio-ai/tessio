// SPDX-License-Identifier: AGPL-3.0-only

import { request } from '../api/client';

export type Role = 'admin' | 'agent' | 'requester';
export interface AuthUser { id: string; email: string; name: string; role: Role; }

export function login(email: string, password: string): Promise<AuthUser> {
  return request<AuthUser>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
}

export function logout(): Promise<void> {
  return request<void>('/auth/logout', { method: 'POST' });
}

export function me(): Promise<AuthUser> {
  return request<AuthUser>('/auth/me');
}
