// SPDX-License-Identifier: AGPL-3.0-only

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReportDefinition } from '@tessio/shared';
import {
  listReports,
  getReport,
  createReport,
  updateReport,
  deleteReport,
  runReport,
} from '../../api/reports';

export const useReports = () => useQuery({ queryKey: ['reports'], queryFn: listReports });
export const useReport = (id: string) => useQuery({ queryKey: ['report', id], queryFn: () => getReport(id), enabled: !!id });

function invalidate(qc: ReturnType<typeof useQueryClient>, id?: string) {
  void qc.invalidateQueries({ queryKey: ['reports'] });
  if (id) void qc.invalidateQueries({ queryKey: ['report', id] });
}

export function useCreateReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; description?: string; definition: ReportDefinition }) => createReport(body),
    onSuccess: () => invalidate(qc),
  });
}

export function useUpdateReport(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: { name?: string; description?: string; definition?: ReportDefinition }) => updateReport(id, patch),
    onSuccess: () => invalidate(qc, id),
  });
}

export function useDeleteReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteReport(id),
    onSuccess: (_d, id) => invalidate(qc, id),
  });
}

/** Mutation for running an arbitrary definition (used by the builder preview). */
export function useRunReport() {
  return useMutation({
    mutationFn: (definition: ReportDefinition) => runReport(definition),
  });
}
