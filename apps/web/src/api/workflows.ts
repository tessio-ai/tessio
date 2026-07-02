// SPDX-License-Identifier: AGPL-3.0-only

import { request } from './client';
import type { WorkflowGraph, WorkflowStatus, WorkflowRunStatus, WorkflowNodeRunStatus } from '@tessio/shared';

export interface WorkflowRow {
  id: string;
  name: string;
  description: string;
  status: WorkflowStatus;
  version: number;
  graph: WorkflowGraph;
  publishedGraph: WorkflowGraph | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowListRow extends WorkflowRow {
  hasUnpublishedChanges: boolean;
  lastRun: { id: string; status: WorkflowRunStatus; createdAt: string; finishedAt: string | null } | null;
}

export interface WorkflowRunRow {
  id: string;
  workflowId: string;
  workflowVersion: number;
  triggerKind: 'event' | 'manual' | 'test';
  triggerContext: { ticketId?: string; ticket?: Record<string, unknown>; event?: { eventType: string } };
  graph: WorkflowGraph;
  status: WorkflowRunStatus;
  context: Record<string, unknown> | null;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface WorkflowNodeRunRow {
  id: string;
  nodeId: string;
  status: WorkflowNodeRunStatus;
  input: unknown;
  output: unknown;
  error: string | null;
  logs: unknown[] | null;
  startedAt: string;
  finishedAt: string | null;
}

export type WorkflowRunDetail = WorkflowRunRow & { nodeRuns: WorkflowNodeRunRow[] };

/** Publish-time validation failure detail (problem+json `errors` extension). */
export interface GraphErrorItem {
  nodeId?: string;
  edgeId?: string;
  message: string;
}

export const listWorkflows = (): Promise<WorkflowListRow[]> => request('/workflows');
export const getWorkflow = (id: string): Promise<WorkflowRow> => request(`/workflows/${id}`);
export const createWorkflow = (body: { name: string; description?: string }): Promise<WorkflowRow> =>
  request('/workflows', { method: 'POST', body: JSON.stringify(body) });
export const updateWorkflow = (
  id: string,
  patch: { name?: string; description?: string; graph?: WorkflowGraph },
): Promise<WorkflowRow> => request(`/workflows/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
export const publishWorkflow = (id: string): Promise<WorkflowRow> =>
  request(`/workflows/${id}/publish`, { method: 'POST', body: JSON.stringify({}) });
export const setWorkflowStatus = (id: string, status: 'active' | 'paused' | 'archived'): Promise<WorkflowRow> =>
  request(`/workflows/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) });
export const runWorkflow = (id: string, body: { ticketId: string; draft?: boolean }): Promise<WorkflowRunRow> =>
  request(`/workflows/${id}/run`, { method: 'POST', body: JSON.stringify(body) });
export const listWorkflowRuns = (id: string): Promise<WorkflowRunRow[]> => request(`/workflows/${id}/runs`);
export const getWorkflowRun = (id: string, runId: string): Promise<WorkflowRunDetail> =>
  request(`/workflows/${id}/runs/${runId}`);
