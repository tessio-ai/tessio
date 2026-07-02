// SPDX-License-Identifier: AGPL-3.0-only

import { request } from './client';

export interface TeamMemberRow {
  teamId: string;
  userId: string;
  createdAt: string;
}

export const listTeamMembers = (teamId: string) =>
  request<TeamMemberRow[]>(`/teams/${teamId}/members`);

export const addTeamMember = (teamId: string, userId: string) =>
  request<TeamMemberRow>(`/teams/${teamId}/members`, { method: 'POST', body: JSON.stringify({ userId }) });

export const removeTeamMember = (teamId: string, userId: string) =>
  request<void>(`/teams/${teamId}/members/${userId}`, { method: 'DELETE' });
