// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { triggerMatches, findTrigger } from './trigger';
import type { WorkflowGraph } from '@tessio/shared';

const ticket = { id: 'tk1', status: 'open', priority: 'high', data: { category: 'hw' } };

describe('triggerMatches', () => {
  it('matches subscribed event types only', () => {
    const config = { events: ['created' as const, 'status' as const] };
    expect(triggerMatches(config, { eventType: 'created' }, ticket)).toBe(true);
    expect(triggerMatches(config, { eventType: 'priority' }, ticket)).toBe(false);
  });

  it('field_changed honours the field allowlist', () => {
    const config = { events: ['field_changed' as const], fields: ['category'] };
    expect(triggerMatches(config, { eventType: 'field_changed', changes: { field: 'category', from: 'a', to: 'b' } }, ticket)).toBe(true);
    expect(triggerMatches(config, { eventType: 'field_changed', changes: { field: 'other' } }, ticket)).toBe(false);
    // empty allowlist = any field
    expect(triggerMatches({ events: ['field_changed'], fields: [] }, { eventType: 'field_changed', changes: { field: 'x' } }, ticket)).toBe(true);
  });

  it('evaluates the condition against the ticket', () => {
    const config = {
      events: ['status' as const],
      condition: { and: [{ field: 'priority', op: 'eq' as const, value: 'high' }, { field: 'data.category', op: 'eq' as const, value: 'hw' }] },
    };
    expect(triggerMatches(config, { eventType: 'status' }, ticket)).toBe(true);
    expect(triggerMatches(config, { eventType: 'status' }, { ...ticket, priority: 'low' })).toBe(false);
  });
});

describe('findTrigger', () => {
  it('finds the trigger node', () => {
    const graph: WorkflowGraph = {
      nodes: [
        { id: 'a', type: 'add_comment', position: { x: 0, y: 0 }, config: { body: 'x' } },
        { id: 't', type: 'trigger', position: { x: 0, y: 0 }, config: { events: ['created'] } },
      ],
      edges: [],
    };
    expect(findTrigger(graph)?.id).toBe('t');
    expect(findTrigger({ nodes: [], edges: [] })).toBeUndefined();
  });
});
