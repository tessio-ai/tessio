// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, vi } from 'vitest';
import type { WorkflowScope, WorkflowNode } from '@tessio/shared';
import { prepareNodeInput, executeNode, buildAuthHeaders, type NodeExecDeps } from './node-runners';

function scope(): WorkflowScope {
  return {
    trigger: { event: { eventType: 'created' } },
    ticket: { id: 'tk1', priority: 'high', data: { category: 'hw' } },
    nodes: { prev: { output: { tier: 2 } } },
    run: { id: 'r1' },
  };
}

function deps(overrides: Partial<NodeExecDeps> = {}): NodeExecDeps {
  return {
    updateTicket: vi.fn(async () => ({ ticket: { id: 'tk1', status: 'resolved' }, updated: ['status'] })),
    createSubtask: vi.fn(async () => ({ ticketId: 'tk2', number: 42 })),
    addComment: vi.fn(async () => ({ commentId: 'c9' })),
    fetchFn: vi.fn() as unknown as typeof fetch,
    runScript: vi.fn(async () => ({ ok: 1 })),
    sendSlack: vi.fn(async () => {}),
    ...overrides,
  };
}

function node<T extends WorkflowNode['type']>(type: T, config: Record<string, unknown>): WorkflowNode {
  return { id: 'n1', type, position: { x: 0, y: 0 }, config } as WorkflowNode;
}

describe('prepareNodeInput', () => {
  it('interpolates action configs against the scope', () => {
    const n = node('add_comment', { body: 'P={{ ticket.priority }} tier={{ nodes.prev.output.tier }}' });
    expect(prepareNodeInput(n, scope())).toEqual({ body: 'P=high tier=2' });
  });

  it('leaves script code uninterpolated', () => {
    const n = node('script', { code: 'return "{{ not a template }}";' });
    expect(prepareNodeInput(n, scope())).toEqual({ code: 'return "{{ not a template }}";' });
  });
});

describe('executeNode', () => {
  it('update_ticket prunes empty values, applies the patch, and refreshes scope.ticket', async () => {
    const d = deps();
    const s = scope();
    const n = node('update_ticket', { set: { status: 'resolved', priority: '', data: { reviewed: 'yes' } } });
    const { output } = await executeNode(n, prepareNodeInput(n, s), s, d);
    expect(d.updateTicket).toHaveBeenCalledWith('tk1', { status: 'resolved', data: { reviewed: 'yes' } });
    expect(output).toEqual({ updated: ['status'] });
    expect(s.ticket.status).toBe('resolved');
  });

  it('update_ticket re-parents via parentId', async () => {
    const d = deps();
    const s = scope();
    const n = node('update_ticket', { set: { parentId: 'tk9' } });
    await executeNode(n, prepareNodeInput(n, s), s, d);
    expect(d.updateTicket).toHaveBeenCalledWith('tk1', { parentId: 'tk9' });
  });

  it('create_subtask creates a child under the subject ticket, pruning empties', async () => {
    const d = deps();
    const s = scope();
    const n = node('create_subtask', {
      title: 'Follow up on {{ ticket.priority }}',
      description: 'child of {{ ticket.id }}',
      priority: '',
      teamId: 'team7',
      data: { area: 'billing' },
    });
    const { output } = await executeNode(n, prepareNodeInput(n, s), s, d);
    expect(d.createSubtask).toHaveBeenCalledWith('tk1', {
      title: 'Follow up on high',
      description: 'child of tk1',
      teamId: 'team7',
      data: { area: 'billing' },
    });
    expect(output).toEqual({ ticketId: 'tk2', number: 42 });
  });

  it('add_comment posts the interpolated body', async () => {
    const d = deps();
    const s = scope();
    const n = node('add_comment', { body: 'priority is {{ ticket.priority }}', internal: true });
    const { output } = await executeNode(n, prepareNodeInput(n, s), s, d);
    expect(d.addComment).toHaveBeenCalledWith('tk1', 'priority is high', true);
    expect(output).toEqual({ commentId: 'c9' });
  });

  it('http_request returns status/ok/body, parsing JSON and keeping non-2xx as data', async () => {
    const fetchFn = vi.fn(async () => new Response('{"hello":"world"}', { status: 404, headers: { 'x-a': 'b' } }));
    const d = deps({ fetchFn: fetchFn as unknown as typeof fetch });
    const s = scope();
    // Public IP literal so the SSRF guard passes without a DNS lookup (fetchFn is mocked).
    const n = node('http_request', { method: 'POST', url: 'https://93.184.216.34/{{ ticket.id }}', body: '{"p":"{{ ticket.priority }}"}' });
    const { output } = await executeNode(n, prepareNodeInput(n, s), s, d);

    const [url, init] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://93.184.216.34/tk1');
    expect(init.body).toBe('{"p":"high"}');
    expect(output).toMatchObject({ status: 404, ok: false, body: { hello: 'world' } });
  });

  it('http_request fails the node on network error', async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    });
    const d = deps({ fetchFn: fetchFn as unknown as typeof fetch });
    const s = scope();
    const n = node('http_request', { method: 'GET', url: 'https://93.184.216.34' });
    await expect(executeNode(n, prepareNodeInput(n, s), s, d)).rejects.toThrow('ECONNREFUSED');
  });

  it('http_request blocks an SSRF target before fetching', async () => {
    const fetchFn = vi.fn();
    const d = deps({ fetchFn: fetchFn as unknown as typeof fetch });
    const s = scope();
    const n = node('http_request', { method: 'GET', url: 'http://169.254.169.254/latest/meta-data/' });
    await expect(executeNode(n, prepareNodeInput(n, s), s, d)).rejects.toThrow(/private or internal/);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('http_request follows a redirect to a public host and returns the final response', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: 'https://8.8.8.8/final' } }))
      .mockResolvedValueOnce(new Response('{"done":true}', { status: 200 }));
    const d = deps({ fetchFn: fetchFn as unknown as typeof fetch });
    const s = scope();
    const n = node('http_request', { method: 'GET', url: 'https://93.184.216.34/start' });
    const { output } = await executeNode(n, prepareNodeInput(n, s), s, d);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect((fetchFn.mock.calls[1] as [string, RequestInit])[0]).toBe('https://8.8.8.8/final');
    expect(output).toMatchObject({ status: 200, ok: true, body: { done: true } });
  });

  // Regression: the SSRF guard must re-run on the redirect target, not just the
  // initial URL. A public host that 302s to the metadata endpoint must be blocked.
  it('http_request blocks a redirect that points at an internal address (SSRF via 30x)', async () => {
    const fetchFn = vi.fn(
      async () => new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/latest/meta-data/' } }),
    );
    const d = deps({ fetchFn: fetchFn as unknown as typeof fetch });
    const s = scope();
    const n = node('http_request', { method: 'GET', url: 'https://93.184.216.34/redir' });
    await expect(executeNode(n, prepareNodeInput(n, s), s, d)).rejects.toThrow(/private or internal/);
    // First hop is fetched; the redirect target is rejected before any second fetch.
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('http_request drops Authorization when a redirect crosses origins (preserves method+body on 307)', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 307, headers: { location: 'https://8.8.8.8/x' } }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    const d = deps({ fetchFn: fetchFn as unknown as typeof fetch });
    const s = scope();
    const n = node('http_request', { method: 'POST', url: 'https://93.184.216.34/start', body: 'b', auth: { type: 'bearer', secret: 'k' } });
    await executeNode(n, prepareNodeInput(n, s), s, d, { k: 'tok' });
    const first = (fetchFn.mock.calls[0] as [string, RequestInit])[1];
    const second = (fetchFn.mock.calls[1] as [string, RequestInit])[1];
    expect((first.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    expect((second.headers as Record<string, string>).Authorization).toBeUndefined();
    expect(second.method).toBe('POST');
    expect(second.body).toBe('b');
  });

  it('http_request throws after too many redirects', async () => {
    const fetchFn = vi.fn(async () => new Response(null, { status: 302, headers: { location: 'https://8.8.8.8/loop' } }));
    const d = deps({ fetchFn: fetchFn as unknown as typeof fetch });
    const s = scope();
    const n = node('http_request', { method: 'GET', url: 'https://8.8.8.8/loop' });
    await expect(executeNode(n, prepareNodeInput(n, s), s, d)).rejects.toThrow(/Too many redirects/);
  });

  it('slack_message posts the interpolated text', async () => {
    const d = deps();
    const s = scope();
    const n = node('slack_message', { text: 'Ticket {{ ticket.id }} is {{ ticket.priority }}' });
    const { output } = await executeNode(n, prepareNodeInput(n, s), s, d);
    expect(d.sendSlack).toHaveBeenCalledWith('Ticket tk1 is high');
    expect(output).toEqual({ ok: true });
  });

  it('slack_message fails the node when the integration is not configured', async () => {
    const d = deps({ sendSlack: vi.fn(async () => { throw new Error('Slack integration is not configured'); }) });
    const s = scope();
    const n = node('slack_message', { text: 'hello' });
    await expect(executeNode(n, prepareNodeInput(n, s), s, d)).rejects.toThrow(/not configured/);
  });

  it('script passes ctx and returns the script output', async () => {
    const runScript = vi.fn(async () => ({ category: 'hw' }));
    const d = deps({ runScript });
    const s = scope();
    const n = node('script', { code: 'return ctx.ticket.priority;', timeoutMs: 2000 });
    const { output } = await executeNode(n, prepareNodeInput(n, s), s, d);
    expect(runScript).toHaveBeenCalledWith(
      'return ctx.ticket.priority;',
      { trigger: s.trigger, ticket: s.ticket, nodes: s.nodes, run: s.run },
      2000,
    );
    expect(output).toEqual({ category: 'hw' });
  });
});

describe('buildAuthHeaders', () => {
  it('bearer', () => {
    expect(buildAuthHeaders({ type: 'bearer', secret: 'k' }, { k: 'tok' })).toEqual({ Authorization: 'Bearer tok' });
  });
  it('basic base64', () => {
    const expected = `Basic ${Buffer.from('u:pw').toString('base64')}`;
    expect(buildAuthHeaders({ type: 'basic', username: 'u', secret: 'k' }, { k: 'pw' })).toEqual({ Authorization: expected });
  });
  it('apiKey custom header', () => {
    expect(buildAuthHeaders({ type: 'apiKey', header: 'X-Api-Key', secret: 'k' }, { k: 'v' })).toEqual({ 'X-Api-Key': 'v' });
  });
  it('none / undefined → empty', () => {
    expect(buildAuthHeaders({ type: 'none' }, {})).toEqual({});
    expect(buildAuthHeaders(undefined, {})).toEqual({});
  });
  it('throws when the referenced secret is missing', () => {
    expect(() => buildAuthHeaders({ type: 'bearer', secret: 'missing' }, {})).toThrow(/secret "missing" is not defined/);
  });
});
