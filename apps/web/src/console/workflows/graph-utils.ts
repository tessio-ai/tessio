// SPDX-License-Identifier: AGPL-3.0-only

import type { Node as FlowNode, Edge as FlowEdge } from '@xyflow/react';
import type { FilterLeaf, FilterNode, WorkflowEdge, WorkflowGraph, WorkflowNode, WorkflowNodeType } from '@tessio/shared';

/** Display metadata per node type (label, icon name from icons.tsx, accent hue). */
export const NODE_META: Record<WorkflowNodeType, { label: string; icon: string; hue: string; blurb: string }> = {
  trigger: { label: 'Trigger', icon: 'zap', hue: 'var(--primary)', blurb: 'Starts the workflow off ticket events' },
  branch: { label: 'Branch', icon: 'gitBranch', hue: '#d97706', blurb: 'Route down the first matching path' },
  join: { label: 'Join', icon: 'gitMerge', hue: '#d97706', blurb: 'Converge parallel paths' },
  update_ticket: { label: 'Update ticket', icon: 'edit', hue: '#2563eb', blurb: 'Edit status, priority, assignee, fields' },
  create_subtask: { label: 'Create subtask', icon: 'gitBranch', hue: '#2563eb', blurb: 'Open a child ticket under this one' },
  add_comment: { label: 'Add comment', icon: 'message', hue: '#2563eb', blurb: 'Post a comment or internal note' },
  http_request: { label: 'HTTP request', icon: 'globe', hue: '#7c3aed', blurb: 'Call an external API' },
  script: { label: 'Script', icon: 'code', hue: '#0d9488', blurb: 'Run JavaScript against the run context' },
  slack_message: { label: 'Slack message', icon: 'send', hue: '#611f69', blurb: 'Post to the connected Slack channel' },
};

export const PALETTE: Exclude<WorkflowNodeType, 'trigger'>[] = ['branch', 'join', 'update_ticket', 'create_subtask', 'add_comment', 'slack_message', 'http_request', 'script'];

const TRIGGER_EVENT_LABELS: Record<string, string> = {
  created: 'created',
  status: 'status changed',
  priority: 'priority changed',
  assigned: 'assignee changed',
  team: 'team changed',
  parent: 'parent changed',
  field_changed: 'field changed',
};

const OP_LABELS: Record<FilterLeaf['op'], string> = {
  eq: '=', ne: '≠', lt: '<', lte: '≤', gt: '>', gte: '≥',
  in: 'in', contains: 'contains', startsWith: 'starts with', isNull: 'is empty',
};

/** One-line description of a condition for node cards and edge labels. */
export function describeFilter(filter: FilterNode | undefined): string {
  if (!filter) return '';
  if ('and' in filter) return filter.and.map(describeFilter).join(' and ');
  if ('or' in filter) return filter.or.map(describeFilter).join(' or ');
  if ('not' in filter) return `not (${describeFilter(filter.not)})`;
  const value = filter.op === 'isNull' ? '' : ` ${Array.isArray(filter.value) ? filter.value.join(', ') : String(filter.value ?? '')}`;
  return `${filter.field} ${OP_LABELS[filter.op]}${value}`;
}

/** Short config summary shown on the node card under the title. */
export function summarize(node: WorkflowNode): string {
  switch (node.type) {
    case 'trigger': {
      const events = node.config.events.map((e) => TRIGGER_EVENT_LABELS[e] ?? e).join(', ');
      const cond = node.config.condition ? ` if ${describeFilter(node.config.condition)}` : '';
      return events ? `When ticket ${events}${cond}` : 'Pick at least one event';
    }
    case 'branch':
      return 'First matching path wins';
    case 'join':
      return node.config.mode === 'all' ? 'Wait for all paths' : 'Continue on first path';
    case 'update_ticket': {
      const set = node.config.set ?? {};
      const parts = [
        ...(['status', 'priority', 'assigneeId', 'teamId', 'parentId'] as const).filter((k) => set[k]).map((k) => k.replace('Id', '')),
        ...Object.keys(set.data ?? {}),
      ];
      return parts.length ? `Set ${parts.join(', ')}` : 'No fields set yet';
    }
    case 'create_subtask':
      return node.config.title?.trim() ? `New subtask: ${firstLine(node.config.title)}` : 'Name the subtask';
    case 'add_comment':
      return node.config.internal ? 'Internal note' : 'Public comment';
    case 'http_request':
      return node.config.url ? `${node.config.method} ${node.config.url}` : 'Configure the request';
    case 'script':
      return node.config.code?.trim() ? firstLine(node.config.code) : 'Write some JavaScript';
    case 'slack_message':
      return node.config.text?.trim() ? firstLine(node.config.text) : 'Write a message';
  }
}

function firstLine(code: string): string {
  const line = code.trim().split('\n')[0];
  return line.length > 42 ? `${line.slice(0, 42)}…` : line;
}

/** Unique node id with a friendly prefix (branch_1, script_2, …). */
export function newNodeId(type: WorkflowNodeType, graph: WorkflowGraph): string {
  let n = 1;
  while (graph.nodes.some((node) => node.id === `${type}_${n}`)) n += 1;
  return `${type}_${n}`;
}

const DEFAULT_CONFIGS: Record<Exclude<WorkflowNodeType, 'trigger'>, WorkflowNode['config']> = {
  branch: {},
  join: { mode: 'all' },
  update_ticket: { set: {} },
  create_subtask: { title: '' },
  add_comment: { body: '' },
  http_request: { method: 'GET', url: '' },
  script: { code: "// ctx = { trigger, ticket, nodes, run }\nreturn { ok: true };" },
  slack_message: { text: '' },
};

export function createNode(type: Exclude<WorkflowNodeType, 'trigger'>, graph: WorkflowGraph, position: { x: number; y: number }): WorkflowNode {
  return { id: newNodeId(type, graph), type, position, config: DEFAULT_CONFIGS[type] } as WorkflowNode;
}

export function newEdgeId(graph: WorkflowGraph): string {
  let n = 1;
  while (graph.edges.some((e) => e.id === `edge_${n}`)) n += 1;
  return `edge_${n}`;
}

export function edgeLabel(edge: WorkflowEdge): string {
  if (edge.label) return edge.label;
  if (edge.else) return 'else';
  if (edge.condition) return describeFilter(edge.condition);
  return '';
}

export type NodeStatusMap = Record<string, string | undefined>;

/** Graph → React Flow nodes. `statusByNode` colours the run-detail view. */
export function toFlowNodes(graph: WorkflowGraph, statusByNode?: NodeStatusMap): FlowNode[] {
  return graph.nodes.map((node) => ({
    id: node.id,
    type: 'wf',
    position: node.position,
    deletable: node.type !== 'trigger',
    data: { node, status: statusByNode?.[node.id] },
  }));
}

export function toFlowEdges(graph: WorkflowGraph, statusByNode?: NodeStatusMap): FlowEdge[] {
  return graph.edges.map((edge) => ({
    id: edge.id,
    source: edge.from,
    target: edge.to,
    label: edgeLabel(edge) || undefined,
    animated: !statusByNode && Boolean(edge.condition || edge.else),
  }));
}

/**
 * The builder edits conditions as a flat AND-list of leaves. These helpers map
 * that UI shape onto the FilterNode AST (single leaf or `{ and: [...] }`).
 */
export interface ConditionRow {
  field: string;
  op: FilterLeaf['op'];
  value: string;
}

export function filterToRows(filter: FilterNode | undefined): ConditionRow[] {
  if (!filter) return [];
  if ('and' in filter) return filter.and.flatMap(filterToRows);
  if ('or' in filter || 'not' in filter) return []; // built elsewhere (API/JSON) — not editable as rows
  return [{ field: filter.field, op: filter.op, value: valueToText(filter.value) }];
}

export function rowsToFilter(rows: ConditionRow[]): FilterNode | undefined {
  const leaves: FilterNode[] = rows
    .filter((r) => r.field.trim() !== '')
    .map((r) => ({ field: r.field.trim(), op: r.op, ...(r.op === 'isNull' ? {} : { value: textToValue(r.value, r.op) }) }));
  if (leaves.length === 0) return undefined;
  return leaves.length === 1 ? leaves[0] : { and: leaves };
}

function valueToText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
}

function textToValue(text: string, op: FilterLeaf['op']): unknown {
  if (op === 'in') return text.split(',').map((s) => s.trim()).filter(Boolean);
  const trimmed = text.trim();
  if (trimmed !== '' && !Number.isNaN(Number(trimmed))) return Number(trimmed);
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  return text;
}
