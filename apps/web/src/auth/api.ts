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

/** Always resolves (204 whether or not the email has an account). */
export function forgotPassword(email: string): Promise<void> {
  return request<void>('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
}

export function resetPassword(token: string, password: string): Promise<void> {
  return request<void>('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) });
}
