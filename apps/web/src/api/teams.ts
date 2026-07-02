// SPDX-License-Identifier: AGPL-3.0-only

import { request } from './client';

export interface TeamRow {
  id: string;
  name: string;
  memberCount: number;
  schemaCount: number;
  createdAt: string;
}

export const listTeams = (): Promise<TeamRow[]> => request<TeamRow[]>('/teams');

export const createTeam = (name: string) =>
  request<TeamRow>('/teams', { method: 'POST', body: JSON.stringify({ name }) });

export const renameTeam = (id: string, name: string) =>
  request<TeamRow>(`/teams/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) });

export const deleteTeam = (id: string) =>
  request<void>(`/teams/${id}`, { method: 'DELETE' });
