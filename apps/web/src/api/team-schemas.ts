// SPDX-License-Identifier: AGPL-3.0-only

import { request } from './client';

export interface TeamSchemaRow {
  teamId: string;
  schemaId: string;
  createdAt: string;
}

export const listTeamSchemas = (teamId: string) =>
  request<TeamSchemaRow[]>(`/teams/${teamId}/schemas`);

export const addTeamSchema = (teamId: string, schemaId: string) =>
  request<TeamSchemaRow>(`/teams/${teamId}/schemas`, { method: 'POST', body: JSON.stringify({ schemaId }) });

export const removeTeamSchema = (teamId: string, schemaId: string) =>
  request<void>(`/teams/${teamId}/schemas/${schemaId}`, { method: 'DELETE' });
