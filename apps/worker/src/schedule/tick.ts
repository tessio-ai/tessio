// SPDX-License-Identifier: AGPL-3.0-only

import type { WorkflowGraph } from '@tessio/shared';
import { computeDue, type ScheduledWorkflow } from './due';

export interface ScheduleRow extends ScheduledWorkflow { orgId: string; version: number; graph: WorkflowGraph; }
export interface ScheduleDeps {
  now(): Date;
  loadScheduled(): Promise<ScheduleRow[]>;
  createRun(v: { orgId: string; workflowId: string; workflowVersion: number; triggerKind: 'schedule'; triggerContext: Record<string, unknown>; graph: WorkflowGraph }): Promise<{ id: string }>;
  enqueueRun(orgId: string, runId: string): Promise<void>;
  stampFired(workflowId: string, at: Date): Promise<void>;
}

export async function runScheduleTick(deps: ScheduleDeps): Promise<void> {
  const now = deps.now();
  const rows = await deps.loadScheduled();
  const byId = new Map(rows.map((r) => [r.id, r]));

  // Never-fired workflows get a baseline stamp (no run) so they don't backfill.
  for (const r of rows) {
    if (r.lastFiredAt === null) {
      try { await deps.stampFired(r.id, now); } catch (err) { console.error('schedule baseline stamp failed', r.id, err); }
    }
  }

  const due = computeDue(rows.filter((r) => r.lastFiredAt !== null), now);
  for (const d of due) {
    const wf = byId.get(d.workflowId);
    if (!wf) continue;
    try {
      const run = await deps.createRun({
        orgId: wf.orgId, workflowId: wf.id, workflowVersion: wf.version, triggerKind: 'schedule',
        triggerContext: { schedule: { cron: wf.cron, firedAt: d.firedAt.toISOString() } }, graph: wf.graph,
      });
      await deps.enqueueRun(wf.orgId, run.id);
      await deps.stampFired(wf.id, now);
    } catch (err) {
      console.error('schedule tick: workflow failed to fire', wf.id, err);
    }
  }
}
