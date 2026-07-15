// SPDX-License-Identifier: AGPL-3.0-only

import { request } from './client';

export interface UserRow {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'agent' | 'requester';
  status: 'active' | 'disabled';
  createdAt: string;
}

export const listUsers = (): Promise<UserRow[]> => request<UserRow[]>('/users');

export const createUser = (body: { email: string; name: string; role: UserRow['role']; password: string }) =>
  request<UserRow>('/users', { method: 'POST', body: JSON.stringify(body) });

export const updateUser = (id: string, patch: { role?: UserRow['role']; status?: UserRow['status'] }) =>
  request<UserRow>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });

export interface ImportUserInput { email: string; name: string; role: UserRow['role']; }
export interface ImportUsersResult {
  created: { email: string; name: string; role: UserRow['role']; password: string }[];
  skipped: { email: string; reason: string }[];
}
export const importUsers = (users: ImportUserInput[]) =>
  request<ImportUsersResult>('/users/import', { method: 'POST', body: JSON.stringify({ users }) });

/** Admin-initiated reset: returns the generated password exactly once. */
export const resetUserPassword = (id: string) =>
  request<{ password: string }>(`/users/${id}/reset-password`, { method: 'POST', body: JSON.stringify({}) });
