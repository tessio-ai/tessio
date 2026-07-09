// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, vi } from 'vitest';
import type { WorkflowGraph } from '@tessio/shared';
import { executeRun, pickBranchEdge, type EngineDeps } from './engine';
import type { NodeExecDeps } from './node-runners';

function trigger(id = 't') {
  return { id, type: 'trigger' as const, position: { x: 0, y: 0 }, config: { events: ['created' as const] } };
}
function comment(id: string, body = 'hi') {
  return { id, type: 'add_comment' as const, position: { x: 0, y: 0 }, config: { body } };
}
function script(id: string, code = 'return 1;') {
  return { id, type: 'script' as const, position: { x: 0, y: 0 }, config: { code } };
}
function branch(id: string) {
  return { id, type: 'branch' as const, position: { x: 0, y: 0 }, config: {} };
}
function join(id: string, mode: 'all' | 'any') {
  return { id, type: 'join' as const, position: { x: 0, y: 0 }, config: { mode } };
}
function edge(id: string, from: string, to: string, extra: Record<string, unknown> = {}) {
  return { id, from, to, ...extra };
}

interface Recorded {
  nodeRuns: { nodeId: string; input: unknown; status?: string; output?: unknown; error?: string }[];
  run: { status?: string; error?: string; context?: Record<string, unknown> };
}

function makeDeps(exec: Partial<NodeExecDeps> = {}): { deps: EngineDeps; recorded: Recorded } {
  const recorded: Recorded = { nodeRuns: [], run: {} };
  const byId = new Map<string, Recorded['nodeRuns'][number]>();
  let seq = 0;
  const deps: EngineDeps = {
    markRunning: vi.fn(async () => {}),
    finishRun: async (_runId, patch) => {
      recorded.run = patch;
    },
    createNodeRun: async (_runId, nodeId, input) => {
      const id = `nr${(seq += 1)}`;
      const row = { nodeId, input };
      byId.set(id, row);
      recorded.nodeRuns.push(row);
      return id;
    },
    finishNodeRun: async (id, patch) => {
      Object.assign(byId.get(id) as object, patch);
    },
    loadSecrets: async () => ({}),
    exec: {
      updateTicket: async () => ({ ticket: { id: 'tk1' }, updated: [] }),
      createSubtask: async () => ({ ticketId: 'tk2', number: 2 }),
      addComment: async () => ({ commentId: 'c1' }),
      fetchFn: (() => {
        throw new Error('no fetch in this test');
      }) as unknown as typeof fetch,
      runScript: async () => 1,
      sendSlack: async () => {},
      ...exec,
    },
  };
  return { deps, recorded };
}

function run(graph: WorkflowGraph, triggerContext: Record<string, unknown> = { ticket: { id: 'tk1' } }) {
  return { id: 'run1', graph, triggerContext };
}

describe('executeRun', () => {
  it('executes a linear flow and completes with node outputs in context', async () => {
    const graph: WorkflowGraph = {
      nodes: [trigger(), script('s1'), comment('c1', 'n={{ nodes.s1.output }}')],
      edges: [edge('e1', 't', 's1'), edge('e2', 's1', 'c1')],
    };
    const addComment = vi.fn(async () => ({ commentId: 'cm' }));
    const { deps, recorded } = makeDeps({ runScript: async () => 42, addComment });

    await executeRun(deps, run(graph));

    expect(recorded.run.status).toBe('completed');
    expect(recorded.nodeRuns.map((n) => [n.nodeId, n.status])).toEqual([
      ['s1', 'completed'],
      ['c1', 'completed'],
    ]);
    // The comment body was interpolated from the script output.
    expect(addComment).toHaveBeenCalledWith('tk1', 'n=42', false);
    expect((recorded.run.context as { nodes: Record<string, unknown> }).nodes.s1).toEqual({ output: 42 });
  });

  it('branch routes to the first matching conditional edge', async () => {
    const graph: WorkflowGraph = {
      nodes: [trigger(), branch('b'), comment('high'), comment('low')],
      edges: [
        edge('e1', 't', 'b'),
        edge('e2', 'b', 'high', { condition: { field: 'ticket.priority', op: 'eq', value: 'high' } }),
        edge('e3', 'b', 'low', { else: true }),
      ],
    };
    const { deps, recorded } = makeDeps();
    await executeRun(deps, run(graph, { ticket: { id: 'tk1', priority: 'high' } }));

    const executed = recorded.nodeRuns.map((n) => n.nodeId);
    expect(executed).toContain('high');
    expect(executed).not.toContain('low');
    expect(recorded.run.status).toBe('completed');
  });

  it('branch falls back to the else edge, and ends the path with no match and no else', async () => {
    const cond = { field: 'ticket.priority', op: 'eq' as const, value: 'high' };
    const withElse: WorkflowGraph = {
      nodes: [trigger(), branch('b'), comment('high'), comment('other')],
      edges: [edge('e1', 't', 'b'), edge('e2', 'b', 'high', { condition: cond }), edge('e3', 'b', 'other', { else: true })],
    };
    const { deps, recorded } = makeDeps();
    await executeRun(deps, run(withElse, { ticket: { id: 'tk1', priority: 'low' } }));
    expect(recorded.nodeRuns.map((n) => n.nodeId)).toEqual(['b', 'other']);

    const noElse: WorkflowGraph = {
      nodes: [trigger(), branch('b'), comment('high')],
      edges: [edge('e1', 't', 'b'), edge('e2', 'b', 'high', { condition: cond })],
    };
    const second = makeDeps();
    await executeRun(second.deps, run(noElse, { ticket: { id: 'tk1', priority: 'low' } }));
    expect(second.recorded.nodeRuns.map((n) => n.nodeId)).toEqual(['b']);
    expect(second.recorded.run.status).toBe('completed');
  });

  it('parallel fan-out converges at an all-join exactly once, after both branches', async () => {
    const graph: WorkflowGraph = {
      nodes: [trigger(), script('a'), script('b'), join('j', 'all'), comment('after')],
      edges: [edge('e1', 't', 'a'), edge('e2', 't', 'b'), edge('e3', 'a', 'j'), edge('e4', 'b', 'j'), edge('e5', 'j', 'after')],
    };
    const { deps, recorded } = makeDeps();
    await executeRun(deps, run(graph));

    const order = recorded.nodeRuns.map((n) => n.nodeId);
    expect(order.filter((id) => id === 'j')).toHaveLength(1);
    expect(order.filter((id) => id === 'after')).toHaveLength(1);
    expect(order.indexOf('j')).toBeGreaterThan(order.indexOf('a'));
    expect(order.indexOf('j')).toBeGreaterThan(order.indexOf('b'));
    expect(recorded.run.status).toBe('completed');
  });

  it('an any-join fires on the first arrival only', async () => {
    const graph: WorkflowGraph = {
      nodes: [trigger(), script('a'), script('b'), join('j', 'any'), comment('after')],
      edges: [edge('e1', 't', 'a'), edge('e2', 't', 'b'), edge('e3', 'a', 'j'), edge('e4', 'b', 'j'), edge('e5', 'j', 'after')],
    };
    const { deps, recorded } = makeDeps();
    await executeRun(deps, run(graph));

    const order = recorded.nodeRuns.map((n) => n.nodeId);
    expect(order.filter((id) => id === 'j')).toHaveLength(1);
    expect(order.filter((id) => id === 'after')).toHaveLength(1);
  });

  it('a node failure fails the run and stops scheduling downstream nodes', async () => {
    const graph: WorkflowGraph = {
      nodes: [trigger(), script('boom'), comment('never')],
      edges: [edge('e1', 't', 'boom'), edge('e2', 'boom', 'never')],
    };
    const { deps, recorded } = makeDeps({
      runScript: async () => {
        throw new Error('kaput');
      },
    });
    await executeRun(deps, run(graph));

    expect(recorded.run.status).toBe('failed');
    expect(recorded.run.error).toContain('kaput');
    const boom = recorded.nodeRuns.find((n) => n.nodeId === 'boom');
    expect(boom?.status).toBe('failed');
    expect(boom?.error).toContain('kaput');
    expect(recorded.nodeRuns.map((n) => n.nodeId)).not.toContain('never');
  });

  it('fails cleanly when the graph has no trigger', async () => {
    const { deps, recorded } = makeDeps();
    await executeRun(deps, run({ nodes: [comment('c')], edges: [] }));
    expect(recorded.run.status).toBe('failed');
    expect(recorded.run.error).toMatch(/trigger/i);
  });

  it('records redacted secret input but executes with resolved values', async () => {
    let sentHeaders: Record<string, string> | undefined;

    const { deps, recorded } = makeDeps({
      fetchFn: (async (_url: string, init: RequestInit) => {
        sentHeaders = init.headers as Record<string, string>;
        return {
          status: 200,
          ok: true,
          headers: { entries: () => [][Symbol.iterator]() },
          text: async () => '{}',
        };
      }) as unknown as typeof fetch,
    });

    // Override loadSecrets to supply a real secret value.
    deps.loadSecrets = async () => ({ stripe_key: 'sk_live_secret' });

    const graph: WorkflowGraph = {
      nodes: [
        trigger(),
        { id: 'h', type: 'http_request', position: { x: 0, y: 0 }, config: { method: 'GET', url: 'https://93.184.216.34', auth: { type: 'bearer', secret: 'stripe_key' } } },
      ],
      edges: [edge('e', 't', 'h')],
    };

    await executeRun(deps, { id: 'r1', graph, triggerContext: { ticket: { id: 't1' } } });

    // Recorded input must NOT contain the plaintext; auth keeps the secret NAME.
    expect(JSON.stringify(recorded.nodeRuns)).not.toContain('sk_live_secret');
    // The live request used the resolved bearer token.
    expect(sentHeaders).toMatchObject({ Authorization: 'Bearer sk_live_secret' });
  });

  it('missing secret fails the node run and the overall run without sending an auth header', async () => {
    let fetchCalled = false;

    const { deps, recorded } = makeDeps({
      fetchFn: (async () => {
        fetchCalled = true;
        return { status: 200, ok: true, headers: { entries: () => [][Symbol.iterator]() }, text: async () => '{}' };
      }) as unknown as typeof fetch,
    });

    // loadSecrets returns an empty map — 'absent_key' is not present.
    deps.loadSecrets = async () => ({});

    const graph: WorkflowGraph = {
      nodes: [
        trigger(),
        { id: 'h', type: 'http_request', position: { x: 0, y: 0 }, config: { method: 'GET', url: 'https://93.184.216.34', auth: { type: 'bearer', secret: 'absent_key' } } },
      ],
      edges: [edge('e', 't', 'h')],
    };

    await executeRun(deps, { id: 'r2', graph, triggerContext: { ticket: { id: 'tk1' } } });

    expect(recorded.run.status).toBe('failed');
    expect(recorded.run.error).toContain('absent_key');
    const nodeRun = recorded.nodeRuns.find((n) => n.nodeId === 'h');
    expect(nodeRun?.status).toBe('failed');
    expect(nodeRun?.error).toContain('absent_key');
    expect(fetchCalled).toBe(false);
  });

  it('script node receives no secrets in its ctx — plaintext is never passed through', async () => {
    const capturedCtxList: unknown[] = [];

    const { deps, recorded } = makeDeps({
      runScript: async (_code, ctx) => {
        capturedCtxList.push(ctx);
        return 'done';
      },
    });

    deps.loadSecrets = async () => ({ my_key: 'PLAINTEXT_VALUE' });

    const graph: WorkflowGraph = {
      nodes: [trigger(), script('s1', 'return 1;')],
      edges: [edge('e', 't', 's1')],
    };

    await executeRun(deps, { id: 'r3', graph, triggerContext: { ticket: { id: 'tk1' } } });

    expect(recorded.run.status).toBe('completed');
    expect(capturedCtxList).toHaveLength(1);
    const ctx = capturedCtxList[0] as Record<string, unknown>;

    // ctx must not contain the plaintext secret value.
    expect(JSON.stringify(ctx)).not.toContain('PLAINTEXT_VALUE');
    // ctx must have no 'secrets' field.
    expect(ctx).not.toHaveProperty('secrets');

    // The persisted node-run input also must not expose the plaintext.
    expect(JSON.stringify(recorded.nodeRuns)).not.toContain('PLAINTEXT_VALUE');
  });
});

describe('pickBranchEdge', () => {
  const scope = { trigger: {}, ticket: { tier: 2 }, nodes: {}, run: { id: 'r' } };

  it('takes the first matching condition in edge order', () => {
    const e1 = edge('e1', 'b', 'x', { condition: { field: 'ticket.tier', op: 'gt', value: 5 } });
    const e2 = edge('e2', 'b', 'y', { condition: { field: 'ticket.tier', op: 'gt', value: 1 } });
    const e3 = edge('e3', 'b', 'z', { condition: { field: 'ticket.tier', op: 'gt', value: 0 } });
    expect(pickBranchEdge([e1, e2, e3], scope)?.id).toBe('e2');
  });

  it('falls back to else and returns undefined with no match', () => {
    const cond = edge('e1', 'b', 'x', { condition: { field: 'ticket.tier', op: 'gt', value: 5 } });
    const els = edge('e2', 'b', 'y', { else: true });
    expect(pickBranchEdge([cond, els], scope)?.id).toBe('e2');
    expect(pickBranchEdge([cond], scope)).toBeUndefined();
  });
});
