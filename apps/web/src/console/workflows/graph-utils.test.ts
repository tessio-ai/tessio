// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import type { WorkflowGraph, WorkflowNode } from '@tessio/shared';
import {
  summarize,
  describeFilter,
  newNodeId,
  createNode,
  newEdgeId,
  edgeLabel,
  toFlowNodes,
  toFlowEdges,
  filterToRows,
  rowsToFilter,
} from './graph-utils';

const graph: WorkflowGraph = {
  nodes: [
    { id: 'trigger', type: 'trigger', position: { x: 0, y: 0 }, config: { events: ['created', 'priority'] } },
    { id: 'branch_1', type: 'branch', position: { x: 200, y: 0 }, config: {} },
  ],
  edges: [{ id: 'edge_1', from: 'trigger', to: 'branch_1' }],
};

describe('summarize', () => {
  it('describes trigger events and conditions', () => {
    const t = graph.nodes[0];
    expect(summarize(t)).toBe('When ticket created, priority changed');
    const withCond: WorkflowNode = {
      ...t,
      config: { events: ['created'], condition: { field: 'priority', op: 'eq', value: 'high' } },
    } as WorkflowNode;
    expect(summarize(withCond)).toBe('When ticket created if priority = high');
  });

  it('describes actions briefly', () => {
    expect(
      summarize({ id: 'u', type: 'update_ticket', position: { x: 0, y: 0 }, config: { set: { status: 'open', data: { reviewed: 'yes' } } } }),
    ).toBe('Set status, reviewed');
    expect(summarize({ id: 'h', type: 'http_request', position: { x: 0, y: 0 }, config: { method: 'POST', url: 'https://x.io' } })).toBe(
      'POST https://x.io',
    );
  });
});

describe('describeFilter', () => {
  it('renders leaves, isNull, and boolean trees', () => {
    expect(describeFilter({ field: 'a', op: 'gte', value: 3 })).toBe('a ≥ 3');
    expect(describeFilter({ field: 'a', op: 'isNull' })).toBe('a is empty');
    expect(describeFilter({ and: [{ field: 'a', op: 'eq', value: 1 }, { field: 'b', op: 'in', value: ['x', 'y'] }] })).toBe('a = 1 and b in x, y');
  });
});

describe('id generation', () => {
  it('avoids collisions', () => {
    expect(newNodeId('branch', graph)).toBe('branch_2');
    expect(newNodeId('script', graph)).toBe('script_1');
    expect(newEdgeId(graph)).toBe('edge_2');
  });

  it('createNode seeds a sensible default config', () => {
    const node = createNode('script', graph, { x: 1, y: 2 });
    expect(node.id).toBe('script_1');
    expect(node.position).toEqual({ x: 1, y: 2 });
    expect((node.config as { code: string }).code).toContain('return');
  });
});

describe('flow adapters', () => {
  it('maps nodes with type wf, trigger undeletable, statuses attached', () => {
    const nodes = toFlowNodes(graph, { branch_1: 'completed' });
    expect(nodes[0]).toMatchObject({ id: 'trigger', type: 'wf', deletable: false });
    expect(nodes[1].data).toMatchObject({ status: 'completed' });
  });

  it('maps edges with labels for conditions and else', () => {
    expect(edgeLabel({ id: 'e', from: 'a', to: 'b', else: true })).toBe('else');
    expect(edgeLabel({ id: 'e', from: 'a', to: 'b', condition: { field: 'x', op: 'eq', value: 1 } })).toBe('x = 1');
    const edges = toFlowEdges(graph);
    expect(edges[0]).toMatchObject({ id: 'edge_1', source: 'trigger', target: 'branch_1' });
  });
});

describe('condition row mapping', () => {
  it('round-trips a single leaf and an AND list', () => {
    expect(rowsToFilter([{ field: 'status', op: 'eq', value: 'open' }])).toEqual({ field: 'status', op: 'eq', value: 'open' });
    const f = rowsToFilter([
      { field: 'status', op: 'eq', value: 'open' },
      { field: 'data.count', op: 'gt', value: '5' },
    ]);
    expect(f).toEqual({ and: [{ field: 'status', op: 'eq', value: 'open' }, { field: 'data.count', op: 'gt', value: 5 }] });
    expect(filterToRows(f)).toEqual([
      { field: 'status', op: 'eq', value: 'open' },
      { field: 'data.count', op: 'gt', value: '5' },
    ]);
  });

  it('parses in-lists, booleans, and drops empty rows', () => {
    expect(rowsToFilter([{ field: 'status', op: 'in', value: 'open, pending' }])).toEqual({ field: 'status', op: 'in', value: ['open', 'pending'] });
    expect(rowsToFilter([{ field: 'data.vip', op: 'eq', value: 'true' }])).toEqual({ field: 'data.vip', op: 'eq', value: true });
    expect(rowsToFilter([{ field: '', op: 'eq', value: 'x' }])).toBeUndefined();
    expect(rowsToFilter([{ field: 'x', op: 'isNull', value: '' }])).toEqual({ field: 'x', op: 'isNull' });
  });
});
