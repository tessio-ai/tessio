// SPDX-License-Identifier: AGPL-3.0-only

import { and, eq, desc, isNotNull, sql } from 'drizzle-orm';
import type { WorkflowGraph, WorkflowStatus, WorkflowRunStatus, WorkflowNodeRunStatus } from '@tessio/shared';
import { workflows, workflowRuns, workflowNodeRuns } from '../schema';
import type { Db } from '../client';

type WorkflowRunInsert = typeof workflowRuns.$inferInsert;
type WorkflowNodeRunInsert = typeof workflowNodeRuns.$inferInsert;

/** A fresh workflow starts as a lone trigger node the builder hangs nodes off. */
export function starterGraph(): WorkflowGraph {
  return {
    nodes: [{ id: 'trigger', type: 'trigger', name: 'When…', position: { x: 80, y: 200 }, config: { events: ['created'] } }],
    edges: [],
  };
}

/** Workflow definitions + runs + node runs (spec 5.2/5.5), org-scoped. */
export function workflowsRepo(db: Db) {
  return {
    async list(orgId: string) {
      return db.select().from(workflows).where(eq(workflows.orgId, orgId)).orderBy(desc(workflows.updatedAt));
    },

    async getById(orgId: string, id: string) {
      const rows = await db
        .select()
        .from(workflows)
        .where(and(eq(workflows.orgId, orgId), eq(workflows.id, id)));
      return rows[0];
    },

    async create(values: { orgId: string; name: string; description?: string; createdBy?: string; graph?: WorkflowGraph }) {
      const rows = await db
        .insert(workflows)
        .values({ ...values, graph: values.graph ?? starterGraph() })
        .returning();
      return rows[0];
    },

    async update(orgId: string, id: string, patch: { name?: string; description?: string; graph?: WorkflowGraph }) {
      const rows = await db
        .update(workflows)
        .set({ ...patch, updatedAt: new Date() })
        .where(and(eq(workflows.orgId, orgId), eq(workflows.id, id)))
        .returning();
      return rows[0];
    },

    /** Copy the draft graph live and bump the version; a never-published draft goes active. */
    async publish(orgId: string, id: string) {
      const rows = await db
        .update(workflows)
        .set({
          publishedGraph: sql`${workflows.graph}`,
          version: sql`${workflows.version} + 1`,
          status: sql`case when ${workflows.status} = 'draft' then 'active'::workflow_status else ${workflows.status} end`,
          updatedAt: new Date(),
        })
        .where(and(eq(workflows.orgId, orgId), eq(workflows.id, id)))
        .returning();
      return rows[0];
    },

    async setStatus(orgId: string, id: string, status: WorkflowStatus) {
      const rows = await db
        .update(workflows)
        .set({ status, updatedAt: new Date() })
        .where(and(eq(workflows.orgId, orgId), eq(workflows.id, id)))
        .returning();
      return rows[0];
    },

    /** Workflows whose published graph should receive trigger events. */
    async listActive(orgId: string) {
      return db
        .select()
        .from(workflows)
        .where(and(eq(workflows.orgId, orgId), eq(workflows.status, 'active'), isNotNull(workflows.publishedGraph)));
    },

    /** Cheap producer-side guard: does this org have anything to trigger at all? */
    async hasActive(orgId: string) {
      const rows = await db
        .select({ id: workflows.id })
        .from(workflows)
        .where(and(eq(workflows.orgId, orgId), eq(workflows.status, 'active'), isNotNull(workflows.publishedGraph)))
        .limit(1);
      return rows.length > 0;
    },

    async createRun(values: WorkflowRunInsert) {
      const rows = await db.insert(workflowRuns).values(values).returning();
      return rows[0];
    },

    async getRun(orgId: string, runId: string) {
      const rows = await db
        .select()
        .from(workflowRuns)
        .where(and(eq(workflowRuns.orgId, orgId), eq(workflowRuns.id, runId)));
      return rows[0];
    },

    async listRuns(orgId: string, workflowId: string, limit = 50) {
      return db
        .select()
        .from(workflowRuns)
        .where(and(eq(workflowRuns.orgId, orgId), eq(workflowRuns.workflowId, workflowId)))
        .orderBy(desc(workflowRuns.createdAt), desc(workflowRuns.id))
        .limit(limit);
    },

    async updateRun(
      runId: string,
      patch: Partial<{
        status: WorkflowRunStatus;
        context: Record<string, unknown>;
        error: string | null;
        startedAt: Date;
        finishedAt: Date;
      }>,
    ) {
      const rows = await db.update(workflowRuns).set(patch).where(eq(workflowRuns.id, runId)).returning();
      return rows[0];
    },

    async createNodeRun(values: WorkflowNodeRunInsert) {
      const rows = await db.insert(workflowNodeRuns).values(values).returning();
      return rows[0];
    },

    async updateNodeRun(
      id: string,
      patch: Partial<{
        status: WorkflowNodeRunStatus;
        output: unknown;
        error: string | null;
        logs: unknown[];
        finishedAt: Date;
      }>,
    ) {
      const rows = await db.update(workflowNodeRuns).set(patch).where(eq(workflowNodeRuns.id, id)).returning();
      return rows[0];
    },

    async listNodeRuns(runId: string) {
      return db.select().from(workflowNodeRuns).where(eq(workflowNodeRuns.runId, runId)).orderBy(workflowNodeRuns.startedAt);
    },

    /** Active, published workflows across ALL orgs whose published trigger has a schedule. */
    async listScheduled() {
      const rows = await db.select({
        id: workflows.id, orgId: workflows.orgId, version: workflows.version,
        publishedGraph: workflows.publishedGraph, scheduleLastFiredAt: workflows.scheduleLastFiredAt,
      }).from(workflows).where(and(eq(workflows.status, 'active'), isNotNull(workflows.publishedGraph)));
      return rows.filter((r) => {
        const t = (r.publishedGraph as WorkflowGraph | null)?.nodes.find((n) => n.type === 'trigger');
        return !!(t && (t.config as { schedule?: unknown }).schedule);
      });
    },

    async stampScheduleFired(workflowId: string, at: Date) {
      await db.update(workflows).set({ scheduleLastFiredAt: at }).where(eq(workflows.id, workflowId));
    },
  };
}

export type WorkflowsRepo = ReturnType<typeof workflowsRepo>;
