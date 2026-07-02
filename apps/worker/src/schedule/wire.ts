// SPDX-License-Identifier: AGPL-3.0-only

import { workflowsRepo } from '@tessio/db';
import type { Db } from '@tessio/db';
import type { WorkflowGraph, WorkflowRunJobData } from '@tessio/shared';
import type { Queue } from 'bullmq';
import type { ScheduleDeps, ScheduleRow } from './tick';

export function buildScheduleDeps(db: Db, runsQueue: Queue<WorkflowRunJobData>): ScheduleDeps {
  return {
    now: () => new Date(),

    async loadScheduled(): Promise<ScheduleRow[]> {
      const rows = await workflowsRepo(db).listScheduled();
      const result: ScheduleRow[] = [];
      for (const row of rows) {
        const t = (row.publishedGraph as WorkflowGraph).nodes.find((n) => n.type === 'trigger');
        const sch = (t?.config as { schedule?: { cron: string; timezone?: string } } | undefined)?.schedule;
        if (!sch) continue; // defensive; listScheduled already filters
        result.push({
          id: row.id,
          orgId: row.orgId,
          version: row.version,
          graph: row.publishedGraph as WorkflowGraph,
          cron: sch.cron,
          timezone: sch.timezone,
          lastFiredAt: row.scheduleLastFiredAt ?? null,
        });
      }
      return result;
    },

    async createRun(v) {
      const run = await workflowsRepo(db).createRun({
        orgId: v.orgId,
        workflowId: v.workflowId,
        workflowVersion: v.workflowVersion,
        triggerKind: v.triggerKind,
        triggerContext: v.triggerContext,
        graph: v.graph,
        status: 'queued',
      });
      return { id: run.id };
    },

    async enqueueRun(orgId: string, runId: string): Promise<void> {
      await runsQueue.add('run', { orgId, runId } satisfies WorkflowRunJobData);
    },

    async stampFired(workflowId: string, at: Date): Promise<void> {
      await workflowsRepo(db).stampScheduleFired(workflowId, at);
    },
  };
}
