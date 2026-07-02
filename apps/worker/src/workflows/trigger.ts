// SPDX-License-Identifier: AGPL-3.0-only

import { evaluateFilterDeep, getPath, type WorkflowGraph, type WorkflowNode } from '@tessio/shared';

export interface TriggerEventInput {
  eventType: string;
  changes?: Record<string, unknown> | null;
}

/** The (single) trigger node of a published graph, if well-formed. */
export function findTrigger(graph: WorkflowGraph): Extract<WorkflowNode, { type: 'trigger' }> | undefined {
  return graph.nodes.find((n): n is Extract<WorkflowNode, { type: 'trigger' }> => n.type === 'trigger');
}

/**
 * Does an activity event fire this trigger? Event type must be subscribed;
 * `field_changed` honours the optional field allowlist; the optional condition
 * is a views filter evaluated against the ticket (`status`, `data.category`, …).
 */
export function triggerMatches(
  config: Extract<WorkflowNode, { type: 'trigger' }>['config'],
  event: TriggerEventInput,
  ticket: Record<string, unknown>,
): boolean {
  if (!config.events.includes(event.eventType as (typeof config.events)[number])) return false;
  if (event.eventType === 'field_changed' && config.fields && config.fields.length > 0) {
    const field = getPath(event.changes, 'field');
    if (typeof field !== 'string' || !config.fields.includes(field)) return false;
  }
  if (config.condition && !evaluateFilterDeep(config.condition, ticket)) return false;
  return true;
}
