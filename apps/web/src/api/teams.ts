// SPDX-License-Identifier: AGPL-3.0-only

import { request } from './client';

export interface TeamRow {
  id: string;
  name: string;
  emailAddress: string | null;
  emailName: string | null;
  memberCount: number;
  schemaCount: number;
  createdAt: string;
}

export interface UpdateTeamInput {
  name?: string;
  emailAddress?: string | null;
  emailName?: string | null;
}

export const listTeams = (): Promise<TeamRow[]> => request<TeamRow[]>('/teams');

export const createTeam = (name: string) =>
  request<TeamRow>('/teams', { method: 'POST', body: JSON.stringify({ name }) });

export const updateTeam = (id: string, patch: UpdateTeamInput) =>
  request<TeamRow>(`/teams/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });

export const renameTeam = (id: string, name: string) => updateTeam(id, { name });

export const deleteTeam = (id: string) =>
  request<void>(`/teams/${id}`, { method: 'DELETE' });
