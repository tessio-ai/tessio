// SPDX-License-Identifier: AGPL-3.0-only

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { WorkflowGraph } from '@tessio/shared';
import {
  listWorkflows,
  getWorkflow,
  createWorkflow,
  updateWorkflow,
  publishWorkflow,
  setWorkflowStatus,
  runWorkflow,
  listWorkflowRuns,
  getWorkflowRun,
} from '../../api/workflows';
import { listSchemas } from '../../api/schemas';

export const useWorkflows = () => useQuery({ queryKey: ['workflows'], queryFn: listWorkflows });
export const useWorkflow = (id: string) => useQuery({ queryKey: ['workflow', id], queryFn: () => getWorkflow(id) });
export const useWorkflowRuns = (id: string) =>
  useQuery({
    queryKey: ['workflow-runs', id],
    queryFn: () => listWorkflowRuns(id),
    // Keep the list fresh while something is executing.
    refetchInterval: (q) => (q.state.data?.some((r) => r.status === 'queued' || r.status === 'running') ? 1500 : false),
  });
export const useWorkflowRun = (id: string, runId: string) =>
  useQuery({
    queryKey: ['workflow-run', id, runId],
    queryFn: () => getWorkflowRun(id, runId),
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return s === 'queued' || s === 'running' ? 1000 : false;
    },
  });

function invalidate(qc: ReturnType<typeof useQueryClient>, id?: string) {
  void qc.invalidateQueries({ queryKey: ['workflows'] });
  if (id) void qc.invalidateQueries({ queryKey: ['workflow', id] });
}

export function useCreateWorkflow() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: createWorkflow, onSuccess: () => invalidate(qc) });
}

export function useSaveWorkflow(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: { name?: string; description?: string; graph?: WorkflowGraph }) => updateWorkflow(id, patch),
    onSuccess: () => invalidate(qc, id),
  });
}

export function usePublishWorkflow(id: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => publishWorkflow(id), onSuccess: () => invalidate(qc, id) });
}

export function useSetWorkflowStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'active' | 'paused' | 'archived' }) => setWorkflowStatus(id, status),
    onSuccess: (_d, { id }) => invalidate(qc, id),
  });
}

export function useRunWorkflow(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { ticketId: string; draft?: boolean }) => runWorkflow(id, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['workflow-runs', id] }),
  });
}

/** Union of custom field keys across published ticket schemas — for `ticket.data.*` autocomplete. */
export const useTicketFields = () =>
  useQuery({
    queryKey: ['ticket-field-keys'],
    queryFn: async () => {
      const schemas = await listSchemas({ kind: 'ticket', status: 'published' });
      const keys = new Set<string>();
      for (const s of schemas) for (const f of s.definition.fields) keys.add(f.key);
      return [...keys];
    },
  });
