// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { isValidCron, validateWorkflowGraph, type WorkflowGraph, type WorkflowNode } from './workflow';

const trig = (config: Record<string, unknown>) => ({ id: 't', type: 'trigger' as const, position: { x: 0, y: 0 }, config }) as WorkflowNode;
const script = (id: string) => ({ id, type: 'script' as const, position: { x: 0, y: 0 }, config: { code: 'return 1;' } });

describe('isValidCron', () => {
  it('accepts 5-field crons', () => {
    for (const c of ['0 9 * * 1-5', '*/15 * * * *', '0 0 1 * *', '0 9 * * 1']) expect(isValidCron(c), c).toBe(true);
  });
  it('rejects malformed crons', () => {
    for (const c of ['', '0 9 * *', 'banana', '60 9 * * *', '0 9 * * * *']) expect(isValidCron(c), c).toBe(false);
  });
});

describe('validateWorkflowGraph — schedule', () => {
  it('accepts a schedule trigger with a valid cron and non-ticket nodes', () => {
    const g: WorkflowGraph = { nodes: [trig({ events: [], schedule: { cron: '0 9 * * 1-5' } }), script('s')], edges: [{ id: 'e', from: 't', to: 's' }] };
    expect(validateWorkflowGraph(g)).toEqual([]);
  });
  it('rejects a trigger with both events and a schedule', () => {
    const g: WorkflowGraph = { nodes: [trig({ events: ['created'], schedule: { cron: '0 9 * * *' } })], edges: [] };
    expect(validateWorkflowGraph(g).some((e) => /both|exactly one/i.test(e.message))).toBe(true);
  });
  it('rejects a trigger with neither events nor a schedule', () => {
    expect(validateWorkflowGraph({ nodes: [trig({ events: [] })], edges: [] }).some((e) => /event or a schedule|exactly one/i.test(e.message))).toBe(true);
  });
  it('rejects an invalid cron', () => {
    expect(validateWorkflowGraph({ nodes: [trig({ events: [], schedule: { cron: 'nope' } })], edges: [] }).some((e) => /cron/i.test(e.message))).toBe(true);
  });
  it('rejects ticket-requiring nodes in a scheduled workflow', () => {
    const g: WorkflowGraph = {
      nodes: [trig({ events: [], schedule: { cron: '0 9 * * *' } }), { id: 'c', type: 'add_comment', position: { x: 0, y: 0 }, config: { body: 'hi' } }],
      edges: [{ id: 'e', from: 't', to: 'c' }],
    };
    expect(validateWorkflowGraph(g).some((e) => /scheduled|no subject ticket|ticket/i.test(e.message))).toBe(true);
  });
});
