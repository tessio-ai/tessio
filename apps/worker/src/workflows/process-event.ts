// SPDX-License-Identifier: AGPL-3.0-only

import type { WorkflowEventJobData, WorkflowGraph } from '@tessio/shared';
import { findTrigger, triggerMatches } from './trigger';

export interface ActiveWorkflow {
  id: string;
  version: number;
  publishedGraph: WorkflowGraph;
}

export interface ProcessEventDeps {
  listActiveWorkflows(orgId: string): Promise<ActiveWorkflow[]>;
  getTicket(orgId: string, ticketId: string): Promise<Record<string, unknown> | undefined>;
  createRun(values: {
    orgId: string;
    workflowId: string;
    workflowVersion: number;
    triggerKind: 'event';
    triggerContext: Record<string, unknown>;
    graph: WorkflowGraph;
  }): Promise<{ id: string }>;
  enqueueRun(orgId: string, runId: string): Promise<void>;
}

/**
 * One activity event in → zero or more runs out. Loads the ticket once, checks
 * every active workflow's trigger, and creates + enqueues a pinned run per match.
 */
export async function processWorkflowEvent(data: WorkflowEventJobData, deps: ProcessEventDeps): Promise<string[]> {
  const workflows = await deps.listActiveWorkflows(data.orgId);
  if (workflows.length === 0) return [];

  const ticket = await deps.getTicket(data.orgId, data.event.recordId);
  if (!ticket) return [];

  const runIds: string[] = [];
  for (const wf of workflows) {
    const trigger = findTrigger(wf.publishedGraph);
    if (!trigger || !triggerMatches(trigger.config, data.event, ticket)) continue;
    const run = await deps.createRun({
      orgId: data.orgId,
      workflowId: wf.id,
      workflowVersion: wf.version,
      triggerKind: 'event',
      triggerContext: { event: data.event, ticketId: data.event.recordId, ticket },
      graph: wf.publishedGraph,
    });
    await deps.enqueueRun(data.orgId, run.id);
    runIds.push(run.id);
  }
  return runIds;
}
