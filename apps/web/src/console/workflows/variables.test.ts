// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { buildVariableCatalog } from './variables';
import type { WorkflowGraph } from '@tessio/shared';

const graph = {
  nodes: [
    { id: 'trigger_1', type: 'trigger', position: { x: 0, y: 0 }, config: { events: ['created'] } },
    { id: 'http_1', type: 'http_request', position: { x: 0, y: 0 }, config: { method: 'GET', url: '' } },
    { id: 'script_1', type: 'script', position: { x: 0, y: 0 }, config: { code: '' } },
  ],
  edges: [],
} as unknown as WorkflowGraph;

describe('buildVariableCatalog', () => {
  const cat = buildVariableCatalog(graph, 'script_1', ['category', 'urgency']);
  const paths = cat.map((e) => e.path);

  it('includes fixed ticket columns', () => {
    expect(paths).toContain('ticket.status');
    expect(paths).toContain('ticket.priority');
    expect(paths).toContain('ticket.assigneeId');
  });
  it('includes custom data fields', () => {
    expect(paths).toContain('ticket.data.category');
    expect(paths).toContain('ticket.data.urgency');
  });
  it('includes other nodes output but not self and not trigger node', () => {
    expect(paths).toContain('nodes.http_1.output');
    expect(paths).not.toContain('nodes.script_1.output');
    expect(paths).not.toContain('nodes.trigger_1.output');
  });
  it('includes trigger and run', () => {
    expect(paths).toContain('trigger.event');
    expect(paths).toContain('run.id');
  });
  it('every entry has a kind and a label', () => {
    expect(cat.every((e) => e.kind && e.label)).toBe(true);
  });
});
