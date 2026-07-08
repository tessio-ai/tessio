// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { validateWorkflowGraph, workflowGraph, httpRequestConfig, type WorkflowGraph, type WorkflowNode } from './workflow';

function node(id: string, type: WorkflowNode['type'], config: Record<string, unknown> = {}): WorkflowNode {
  const defaults: Record<string, Record<string, unknown>> = {
    trigger: { events: ['created'] },
    join: { mode: 'all' },
    update_ticket: { set: { status: 'open' } },
    add_comment: { body: 'hi' },
    http_request: { method: 'GET', url: 'https://example.com' },
    script: { code: 'return 1;' },
    slack_message: { text: 'hi' },
  };
  return {
    id,
    type,
    position: { x: 0, y: 0 },
    config: { ...(defaults[type] ?? {}), ...config },
  } as WorkflowNode;
}

function edge(id: string, from: string, to: string, extra: Record<string, unknown> = {}) {
  return { id, from, to, ...extra };
}

/** trigger → branch →(cond)→ http → join ; branch →(else)→ script → join ; join → update */
function validGraph(): WorkflowGraph {
  return {
    nodes: [
      node('t', 'trigger'),
      node('b', 'branch'),
      node('h', 'http_request'),
      node('s', 'script'),
      node('j', 'join'),
      node('u', 'update_ticket'),
    ],
    edges: [
      edge('e1', 't', 'b'),
      edge('e2', 'b', 'h', { condition: { field: 'ticket.priority', op: 'eq', value: 'high' } }),
      edge('e3', 'b', 's', { else: true }),
      edge('e4', 'h', 'j'),
      edge('e5', 's', 'j'),
      edge('e6', 'j', 'u'),
    ],
  };
}

describe('workflowGraph schema', () => {
  it('parses a valid graph', () => {
    expect(workflowGraph.safeParse(validGraph()).success).toBe(true);
  });

  it('rejects unknown node types', () => {
    const g = validGraph();
    (g.nodes[1] as { type: string }).type = 'nope';
    expect(workflowGraph.safeParse(g).success).toBe(false);
  });
});

describe('validateWorkflowGraph', () => {
  it('accepts the valid fixture', () => {
    expect(validateWorkflowGraph(validGraph())).toEqual([]);
  });

  it('requires exactly one trigger', () => {
    const g = validGraph();
    g.nodes = g.nodes.filter((n) => n.id !== 't');
    g.edges = g.edges.filter((e) => e.from !== 't');
    expect(validateWorkflowGraph(g).some((e) => /trigger/i.test(e.message))).toBe(true);

    const g2 = validGraph();
    g2.nodes.push(node('t2', 'trigger'));
    expect(validateWorkflowGraph(g2).some((e) => /trigger/i.test(e.message))).toBe(true);
  });

  it('rejects edges into the trigger and unknown endpoints', () => {
    const g = validGraph();
    g.edges.push(edge('bad1', 'u', 't'));
    g.edges.push(edge('bad2', 'ghost', 'u'));
    const errors = validateWorkflowGraph(g);
    expect(errors.some((e) => e.edgeId === 'bad1')).toBe(true);
    expect(errors.some((e) => e.edgeId === 'bad2')).toBe(true);
  });

  it('rejects duplicate node ids', () => {
    const g = validGraph();
    g.nodes.push(node('u', 'add_comment'));
    expect(validateWorkflowGraph(g).some((e) => /duplicate/i.test(e.message))).toBe(true);
  });

  it('rejects unreachable nodes', () => {
    const g = validGraph();
    g.nodes.push(node('orphan', 'add_comment'));
    expect(validateWorkflowGraph(g).some((e) => e.nodeId === 'orphan' && /unreachable/i.test(e.message))).toBe(true);
  });

  it('rejects cycles', () => {
    const g = validGraph();
    g.edges.push(edge('back', 'u', 'b'));
    expect(validateWorkflowGraph(g).some((e) => /cycle/i.test(e.message))).toBe(true);
  });

  it('enforces branch edge rules', () => {
    // two else edges
    const g = validGraph();
    g.edges = g.edges.map((e) => (e.id === 'e2' ? { ...e, condition: undefined, else: true } : e));
    expect(validateWorkflowGraph(g).some((e) => /else/i.test(e.message))).toBe(true);

    // branch outgoing edge with neither condition nor else
    const g2 = validGraph();
    g2.edges = g2.edges.map((e) => (e.id === 'e2' ? { ...e, condition: undefined } : e));
    expect(validateWorkflowGraph(g2).some((e) => e.edgeId === 'e2')).toBe(true);

    // branch with no outgoing edges
    const g3 = validGraph();
    g3.edges = g3.edges.filter((e) => e.from !== 'b');
    g3.nodes = g3.nodes.filter((n) => !['h', 's', 'j', 'u'].includes(n.id));
    expect(validateWorkflowGraph(g3).some((e) => e.nodeId === 'b')).toBe(true);
  });

  it('enforces join arity', () => {
    const g = validGraph();
    g.edges = g.edges.filter((e) => e.id !== 'e5'); // join now has 1 inbound; s has no outbound
    expect(validateWorkflowGraph(g).some((e) => e.nodeId === 'j' && /incoming/i.test(e.message))).toBe(true);
  });

  it('requires at least one trigger event', () => {
    const g = validGraph();
    g.nodes = g.nodes.map((n) => (n.id === 't' ? { ...n, config: { events: [] } } : n)) as WorkflowGraph['nodes'];
    expect(validateWorkflowGraph(g).some((e) => e.nodeId === 't')).toBe(true);
  });

  it('reports invalid node config', () => {
    const g = validGraph();
    g.nodes = g.nodes.map((n) => (n.id === 'h' ? { ...n, config: { method: 'NOPE', url: 'https://x' } } : n)) as WorkflowGraph['nodes'];
    expect(validateWorkflowGraph(g).some((e) => e.nodeId === 'h')).toBe(true);
  });

  it('drafts may hold empty body/url/code, but publish validation rejects them', () => {
    const g = validGraph();
    g.nodes = g.nodes.map((n) => {
      if (n.id === 'h') return { ...n, config: { method: 'GET', url: '' } };
      if (n.id === 's') return { ...n, config: { code: '  ' } };
      return n;
    }) as WorkflowGraph['nodes'];
    expect(workflowGraph.safeParse(g).success).toBe(true); // saveable draft
    const errors = validateWorkflowGraph(g);
    expect(errors.some((e) => e.nodeId === 'h' && /URL/i.test(e.message))).toBe(true);
    expect(errors.some((e) => e.nodeId === 's' && /code/i.test(e.message))).toBe(true);
  });

  it('rejects a slack_message node with an empty message at publish time', () => {
    const g = validGraph();
    g.nodes.push(node('sl', 'slack_message', { text: '  ' }));
    g.edges.push(edge('e7', 'u', 'sl'));
    expect(workflowGraph.safeParse(g).success).toBe(true); // saveable draft
    const errors = validateWorkflowGraph(g);
    expect(errors.some((e) => e.nodeId === 'sl' && /message/i.test(e.message))).toBe(true);
  });
});

describe('httpRequestConfig.auth', () => {
  it('accepts the four auth shapes and defaults to none-absent', () => {
    expect(httpRequestConfig.parse({ method: 'GET', url: 'x' }).auth).toBeUndefined();
    expect(httpRequestConfig.parse({ method: 'GET', url: 'x', auth: { type: 'bearer', secret: 'k' } }).auth)
      .toEqual({ type: 'bearer', secret: 'k' });
    expect(httpRequestConfig.parse({ method: 'GET', url: 'x', auth: { type: 'basic', username: 'u', secret: 'p' } }).auth)
      .toMatchObject({ type: 'basic', username: 'u', secret: 'p' });
    expect(httpRequestConfig.parse({ method: 'GET', url: 'x', auth: { type: 'apiKey', header: 'X-Api-Key', secret: 'k' } }).auth)
      .toMatchObject({ type: 'apiKey', header: 'X-Api-Key', secret: 'k' });
  });
  it('rejects an unknown auth type', () => {
    expect(() => httpRequestConfig.parse({ method: 'GET', url: 'x', auth: { type: 'oauth' } })).toThrow();
  });
});
