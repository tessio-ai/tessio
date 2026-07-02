// SPDX-License-Identifier: AGPL-3.0-only

import type { WorkflowGraph } from '@tessio/shared';

export interface VariableEntry {
  path: string;
  label: string;
  kind: 'ticket' | 'trigger' | 'node' | 'run';
  detail?: string;
}

/** Ticket system columns available in the run scope (mirror the tickets table). */
export const TICKET_COLUMNS = [
  'id', 'number', 'status', 'priority', 'requesterId', 'assigneeId', 'teamId',
  'dueAt', 'resolvedAt', 'closedAt', 'parentId', 'formId', 'createdAt', 'updatedAt',
];

/** Flat list of `{{ }}` variables for the builder: ticket fields, trigger, other node outputs, run. */
export function buildVariableCatalog(
  graph: WorkflowGraph,
  currentNodeId: string | undefined,
  ticketFieldKeys: string[],
): VariableEntry[] {
  const out: VariableEntry[] = [];
  for (const col of TICKET_COLUMNS) out.push({ path: `ticket.${col}`, label: `ticket.${col}`, kind: 'ticket' });
  for (const key of ticketFieldKeys) out.push({ path: `ticket.data.${key}`, label: `ticket.data.${key}`, kind: 'ticket', detail: 'custom field' });
  out.push({ path: 'trigger.event', label: 'trigger.event', kind: 'trigger' });
  out.push({ path: 'trigger.ticket', label: 'trigger.ticket', kind: 'trigger', detail: 'ticket at trigger time' });
  for (const n of graph.nodes) {
    if (n.type === 'trigger' || n.id === currentNodeId) continue;
    out.push({ path: `nodes.${n.id}.output`, label: `nodes.${n.id}.output`, kind: 'node', detail: n.name ?? n.type });
  }
  out.push({ path: 'run.id', label: 'run.id', kind: 'run' });
  return out;
}
