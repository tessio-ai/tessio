// SPDX-License-Identifier: AGPL-3.0-only

import { request } from './client';
import type { ReportDefinition } from '@tessio/shared';

export interface ReportRow {
  key: string | null;
  value: number;
}

export interface ReportResult {
  rows: ReportRow[];
}

export interface ReportRecord {
  id: string;
  name: string;
  description: string | null;
  definition: ReportDefinition;
  visualization: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReportListItem {
  id: string;
  name: string;
  description: string | null;
  visualization: string;
  updatedAt: string;
}

export const listReports = (): Promise<ReportListItem[]> => request('/reports');
export const getReport = (id: string): Promise<ReportRecord> => request(`/reports/${id}`);
export const createReport = (body: { name: string; description?: string; definition: ReportDefinition }): Promise<ReportRecord> =>
  request('/reports', { method: 'POST', body: JSON.stringify(body) });
export const updateReport = (
  id: string,
  patch: { name?: string; description?: string; definition?: ReportDefinition },
): Promise<ReportRecord> => request(`/reports/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
export const deleteReport = (id: string): Promise<void> => request(`/reports/${id}`, { method: 'DELETE' });
export const runReport = (definition: ReportDefinition): Promise<ReportResult> =>
  request('/reports/run', { method: 'POST', body: JSON.stringify({ definition }) });
export const runSavedReport = (id: string): Promise<ReportResult> => request(`/reports/${id}/run`);
