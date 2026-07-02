// SPDX-License-Identifier: AGPL-3.0-only

import { pgTable, pgEnum, uuid, text, integer, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import type { WorkflowGraph } from '@tessio/shared';
import { orgs } from './orgs';

export const workflowStatus = pgEnum('workflow_status', ['draft', 'active', 'paused', 'archived']);
export const workflowRunStatus = pgEnum('workflow_run_status', ['queued', 'running', 'completed', 'failed', 'canceled']);
export const workflowNodeRunStatus = pgEnum('workflow_node_run_status', ['running', 'completed', 'failed', 'skipped']);

/**
 * Workflow definitions (spec 5.2). One row per workflow; `graph` is the editable
 * draft and `published_graph` is what runs — publish copies graph over it and bumps
 * `version` (in-place versioning, the `schemas` precedent). Runs stay debuggable
 * because every run snapshots the graph it executed.
 */
export const workflows = pgTable(
  'workflows',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    status: workflowStatus('status').notNull().default('draft'),
    version: integer('version').notNull().default(0),
    graph: jsonb('graph').$type<WorkflowGraph>().notNull(),
    publishedGraph: jsonb('published_graph').$type<WorkflowGraph>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    scheduleLastFiredAt: timestamp('schedule_last_fired_at', { withTimezone: true }),
    createdBy: uuid('created_by'),
  },
  (t) => [index('workflows_org_idx').on(t.orgId)],
);

/** One execution instance, pinned to the graph it runs (spec 5.5). */
export const workflowRuns = pgTable(
  'workflow_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id),
    workflowId: uuid('workflow_id')
      .notNull()
      .references(() => workflows.id),
    workflowVersion: integer('workflow_version').notNull(),
    triggerKind: text('trigger_kind').notNull(), // event | manual | test
    triggerContext: jsonb('trigger_context').$type<Record<string, unknown>>().notNull(),
    graph: jsonb('graph').$type<WorkflowGraph>().notNull(),
    status: workflowRunStatus('status').notNull().default('queued'),
    context: jsonb('context').$type<Record<string, unknown>>(),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (t) => [index('workflow_runs_org_wf_idx').on(t.orgId, t.workflowId, t.createdAt)],
);

/** Per-node observability: interpolated input, output, error, captured logs. */
export const workflowNodeRuns = pgTable(
  'workflow_node_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    runId: uuid('run_id')
      .notNull()
      .references(() => workflowRuns.id, { onDelete: 'cascade' }),
    nodeId: text('node_id').notNull(),
    status: workflowNodeRunStatus('status').notNull().default('running'),
    input: jsonb('input').$type<unknown>(),
    output: jsonb('output').$type<unknown>(),
    error: text('error'),
    logs: jsonb('logs').$type<unknown[]>(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (t) => [index('workflow_node_runs_run_idx').on(t.runId)],
);
