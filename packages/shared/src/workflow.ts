// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod';
import { filterNode } from './filter';

/**
 * Workflow graph definition (spec 5.1–5.4): nodes + directed edges, validated
 * acyclic at publish time. Shared by the API (validation), the worker (execution),
 * and the web builder (editing).
 */

/** Ticket activity events a workflow can trigger on (mirrors the events the API records). */
export const triggerEvents = ['created', 'status', 'priority', 'assigned', 'team', 'field_changed'] as const;
export type TriggerEvent = (typeof triggerEvents)[number];

export const HTTP_TIMEOUT_DEFAULT_MS = 10_000;
export const HTTP_TIMEOUT_MAX_MS = 30_000;
export const HTTP_BODY_MAX_BYTES = 256 * 1024;
export const SCRIPT_TIMEOUT_DEFAULT_MS = 1_000;
export const SCRIPT_TIMEOUT_MAX_MS = 5_000;

export const triggerConfig = z.object({
  events: z.array(z.enum(triggerEvents)).default([]),
  /** For `field_changed`: only these data fields fire the trigger (empty/absent = any). */
  fields: z.array(z.string()).optional(),
  /** Condition over the ticket (`status`, `data.category`, …); views filter AST. */
  condition: filterNode.optional(),
  /** Cron schedule trigger — mutually exclusive with `events` (enforced at publish). */
  schedule: z.object({ cron: z.string(), timezone: z.string().optional() }).optional(),
});

export const joinConfig = z.object({ mode: z.enum(['all', 'any']) });

export const updateTicketConfig = z.object({
  set: z.object({
    status: z.string().optional(),
    priority: z.string().optional(),
    assigneeId: z.string().optional(),
    teamId: z.string().optional(),
    data: z.record(z.string()).optional(),
  }),
});

// Required-content rules (non-empty body/url/code) are enforced by
// validateWorkflowGraph at publish time, not here — half-configured nodes must
// still be saveable as drafts.
export const addCommentConfig = z.object({
  body: z.string(),
  internal: z.boolean().optional(),
});

export const httpAuthConfig = z.discriminatedUnion('type', [
  z.object({ type: z.literal('none') }),
  z.object({ type: z.literal('bearer'), secret: z.string() }),
  z.object({ type: z.literal('basic'), username: z.string(), secret: z.string() }),
  z.object({ type: z.literal('apiKey'), header: z.string(), secret: z.string() }),
]);
export type HttpAuthConfig = z.infer<typeof httpAuthConfig>;

export const httpRequestConfig = z.object({
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  url: z.string(),
  headers: z.record(z.string()).optional(),
  body: z.string().optional(),
  timeoutMs: z.number().int().positive().max(HTTP_TIMEOUT_MAX_MS).optional(),
  auth: httpAuthConfig.optional(),
});

export const scriptConfig = z.object({
  code: z.string(),
  timeoutMs: z.number().int().positive().max(SCRIPT_TIMEOUT_MAX_MS).optional(),
});

/** Posts to the org's connected Slack integration (Settings → Slack). */
export const slackMessageConfig = z.object({
  text: z.string(),
});

export const workflowNodeType = z.enum([
  'trigger',
  'branch',
  'join',
  'update_ticket',
  'add_comment',
  'http_request',
  'script',
  'slack_message',
]);
export type WorkflowNodeType = z.infer<typeof workflowNodeType>;

const position = z.object({ x: z.number(), y: z.number() });

const nodeBase = { id: z.string().min(1), name: z.string().optional(), position };

export const workflowNode = z.discriminatedUnion('type', [
  z.object({ ...nodeBase, type: z.literal('trigger'), config: triggerConfig }),
  z.object({ ...nodeBase, type: z.literal('branch'), config: z.object({}).passthrough().default({}) }),
  z.object({ ...nodeBase, type: z.literal('join'), config: joinConfig }),
  z.object({ ...nodeBase, type: z.literal('update_ticket'), config: updateTicketConfig }),
  z.object({ ...nodeBase, type: z.literal('add_comment'), config: addCommentConfig }),
  z.object({ ...nodeBase, type: z.literal('http_request'), config: httpRequestConfig }),
  z.object({ ...nodeBase, type: z.literal('script'), config: scriptConfig }),
  z.object({ ...nodeBase, type: z.literal('slack_message'), config: slackMessageConfig }),
]);
export type WorkflowNode = z.infer<typeof workflowNode>;

export const workflowEdge = z.object({
  id: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  /** Branch routing: conditional edges are tried in array order, first match wins. */
  condition: filterNode.optional(),
  /** Branch fallback edge taken when no conditional edge matches (at most one per branch). */
  else: z.boolean().optional(),
  label: z.string().optional(),
});
export type WorkflowEdge = z.infer<typeof workflowEdge>;

export const workflowGraph = z.object({
  nodes: z.array(workflowNode),
  edges: z.array(workflowEdge),
});
export type WorkflowGraph = z.infer<typeof workflowGraph>;

export interface WorkflowGraphError {
  nodeId?: string;
  edgeId?: string;
  message: string;
}

const CRON_FIELD = /^(\*|(\*|\d+)(\/\d+)?|\d+(-\d+)?(\/\d+)?(,\d+(-\d+)?(\/\d+)?)*)$/;
const CRON_BOUNDS: [number, number][] = [[0, 59], [0, 23], [1, 31], [1, 12], [0, 6]];
/** Structural 5-field cron check (full parsing is done by cron-parser in worker/web). */
export function isValidCron(expr: string): boolean {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  return parts.every((p, i) => {
    if (!CRON_FIELD.test(p)) return false;
    const [lo, hi] = CRON_BOUNDS[i];
    for (const m of p.matchAll(/\d+/g)) { const n = Number(m[0]); if (n < lo || n > hi) return false; }
    return true;
  });
}

/**
 * Full publish-time validation. Drafts may be saved in any (shape-valid) state;
 * a graph must pass this before it can run.
 */
export function validateWorkflowGraph(graph: WorkflowGraph): WorkflowGraphError[] {
  const errors: WorkflowGraphError[] = [];
  const byId = new Map<string, WorkflowNode>();

  for (const n of graph.nodes) {
    if (byId.has(n.id)) errors.push({ nodeId: n.id, message: `Duplicate node id "${n.id}".` });
    byId.set(n.id, n);
  }

  const triggers = graph.nodes.filter((n) => n.type === 'trigger');
  if (triggers.length !== 1) {
    errors.push({ message: `A workflow needs exactly one trigger node (found ${triggers.length}).` });
  }
  const trigger = triggers[0];

  for (const e of graph.edges) {
    if (!byId.has(e.from)) errors.push({ edgeId: e.id, message: `Edge "${e.id}" starts at unknown node "${e.from}".` });
    if (!byId.has(e.to)) errors.push({ edgeId: e.id, message: `Edge "${e.id}" ends at unknown node "${e.to}".` });
    if (trigger && e.to === trigger.id) errors.push({ edgeId: e.id, message: 'Edges cannot flow into the trigger.' });
  }

  // Per-node config re-parse (drafts can hold stale configs after type edits).
  for (const n of graph.nodes) {
    const parsed = workflowNode.safeParse(n);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      errors.push({ nodeId: n.id, message: `Invalid ${n.type} config${issue ? `: ${issue.path.join('.')} ${issue.message}` : ''}.` });
    }
  }

  if (trigger) {
    const hasEvents = trigger.config.events.length > 0;
    const hasSchedule = !!trigger.config.schedule;
    if (hasEvents && hasSchedule) {
      errors.push({ nodeId: trigger.id, message: 'A trigger fires on events or a schedule — set exactly one, not both.' });
    } else if (!hasEvents && !hasSchedule) {
      errors.push({ nodeId: trigger.id, message: 'The trigger needs at least one event or a schedule.' });
    }
    if (hasSchedule) {
      if (!isValidCron(trigger.config.schedule!.cron)) {
        errors.push({ nodeId: trigger.id, message: `Invalid cron expression "${trigger.config.schedule!.cron}".` });
      }
      for (const n of graph.nodes) {
        if (n.type === 'update_ticket' || n.type === 'add_comment') {
          errors.push({ nodeId: n.id, message: `Step "${n.name ?? n.id}" needs a ticket, but a scheduled workflow has no subject ticket.` });
        }
      }
    }
  }

  // Content rules deferred from the draft schema (see config schema comment).
  for (const n of graph.nodes) {
    if (n.type === 'add_comment' && !n.config.body?.trim()) {
      errors.push({ nodeId: n.id, message: `Comment step "${n.name ?? n.id}" has no body.` });
    }
    if (n.type === 'http_request' && !n.config.url?.trim()) {
      errors.push({ nodeId: n.id, message: `HTTP step "${n.name ?? n.id}" has no URL.` });
    }
    if (n.type === 'script' && !n.config.code?.trim()) {
      errors.push({ nodeId: n.id, message: `Script step "${n.name ?? n.id}" has no code.` });
    }
    if (n.type === 'slack_message' && !n.config.text?.trim()) {
      errors.push({ nodeId: n.id, message: `Slack step "${n.name ?? n.id}" has no message.` });
    }
  }

  const out = new Map<string, WorkflowEdge[]>();
  const inCount = new Map<string, number>();
  for (const e of graph.edges) {
    if (!byId.has(e.from) || !byId.has(e.to)) continue;
    out.set(e.from, [...(out.get(e.from) ?? []), e]);
    inCount.set(e.to, (inCount.get(e.to) ?? 0) + 1);
  }

  for (const n of graph.nodes) {
    const outgoing = out.get(n.id) ?? [];
    if (n.type === 'branch') {
      if (outgoing.length === 0) errors.push({ nodeId: n.id, message: 'Branch has no outgoing edges.' });
      const elses = outgoing.filter((e) => e.else);
      if (elses.length > 1) errors.push({ nodeId: n.id, message: 'Branch can have at most one else edge.' });
      for (const e of outgoing) {
        if (!e.condition && !e.else) {
          errors.push({ edgeId: e.id, message: 'Branch edges need a condition (or mark one edge as else).' });
        }
      }
    }
    if (n.type === 'join') {
      if ((inCount.get(n.id) ?? 0) < 2) {
        errors.push({ nodeId: n.id, message: 'A join needs at least two incoming edges.' });
      }
    }
  }

  // Reachability from the trigger.
  if (trigger) {
    const seen = new Set<string>([trigger.id]);
    const stack = [trigger.id];
    while (stack.length) {
      for (const e of out.get(stack.pop() as string) ?? []) {
        if (!seen.has(e.to)) {
          seen.add(e.to);
          stack.push(e.to);
        }
      }
    }
    for (const n of graph.nodes) {
      if (!seen.has(n.id)) errors.push({ nodeId: n.id, message: `Node "${n.name ?? n.id}" is unreachable from the trigger.` });
    }
  }

  // Cycle detection (Kahn over valid edges).
  const degree = new Map<string, number>(graph.nodes.map((n) => [n.id, 0]));
  for (const [to, c] of inCount) degree.set(to, c);
  const queue = [...degree.entries()].filter(([, d]) => d === 0).map(([id]) => id);
  let visited = 0;
  while (queue.length) {
    const id = queue.shift() as string;
    visited += 1;
    for (const e of out.get(id) ?? []) {
      const d = (degree.get(e.to) ?? 0) - 1;
      degree.set(e.to, d);
      if (d === 0) queue.push(e.to);
    }
  }
  if (visited < byId.size) errors.push({ message: 'The graph contains a cycle — workflows must be a DAG.' });

  return errors;
}

/** Queue names shared by the API producers and the worker consumers. */
export const WORKFLOW_EVENTS_QUEUE = 'workflow-events';
export const WORKFLOW_RUNS_QUEUE = 'workflow-runs';
export const SCHEDULE_TICK_QUEUE = 'schedule-tick';

/** One ticket activity event, as published to the workflow-events queue. */
export interface WorkflowEventJobData {
  orgId: string;
  event: {
    eventType: string;
    recordId: string;
    changes?: Record<string, unknown> | null;
  };
}

export interface WorkflowRunJobData {
  orgId: string;
  runId: string;
}

/** Statuses, shared by db enums, API responses, and the web UI. */
export const workflowStatuses = ['draft', 'active', 'paused', 'archived'] as const;
export type WorkflowStatus = (typeof workflowStatuses)[number];
export const workflowRunStatuses = ['queued', 'running', 'completed', 'failed', 'canceled'] as const;
export type WorkflowRunStatus = (typeof workflowRunStatuses)[number];
export const workflowNodeRunStatuses = ['running', 'completed', 'failed', 'skipped'] as const;
export type WorkflowNodeRunStatus = (typeof workflowNodeRunStatuses)[number];

/** The condition scope handed to branch edges and node templates. */
export interface WorkflowScope {
  trigger: Record<string, unknown>;
  ticket: Record<string, unknown>;
  nodes: Record<string, { output: unknown }>;
  run: { id: string };
}
