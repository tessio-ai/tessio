// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import type { WorkflowGraph } from '@tessio/shared';
import { processWorkflowEvent, type ProcessEventDeps } from './process-event';
import { applyTicketUpdate, type TicketActionDeps } from './ticket-actions';

function graphTriggering(events: ('created' | 'status')[]): WorkflowGraph {
  return {
    nodes: [{ id: 't', type: 'trigger', position: { x: 0, y: 0 }, config: { events } }],
    edges: [],
  };
}

describe('processWorkflowEvent', () => {
  function deps(workflows: { id: string; version: number; publishedGraph: WorkflowGraph }[]): {
    deps: ProcessEventDeps;
    created: Record<string, unknown>[];
    enqueued: string[];
  } {
    const created: Record<string, unknown>[] = [];
    const enqueued: string[] = [];
    let n = 0;
    return {
      created,
      enqueued,
      deps: {
        listActiveWorkflows: async () => workflows,
        getTicket: async () => ({ id: 'tk1', status: 'open' }),
        createRun: async (values) => {
          created.push(values);
          return { id: `run${(n += 1)}` };
        },
        enqueueRun: async (_orgId, runId) => {
          enqueued.push(runId);
        },
      },
    };
  }

  it('creates and enqueues a run per matching workflow', async () => {
    const d = deps([
      { id: 'wf1', version: 2, publishedGraph: graphTriggering(['created']) },
      { id: 'wf2', version: 1, publishedGraph: graphTriggering(['status']) },
    ]);
    const runIds = await processWorkflowEvent(
      { orgId: 'o1', event: { eventType: 'created', recordId: 'tk1' } },
      d.deps,
    );
    expect(runIds).toEqual(['run1']);
    expect(d.enqueued).toEqual(['run1']);
    expect(d.created[0]).toMatchObject({
      workflowId: 'wf1',
      workflowVersion: 2,
      triggerKind: 'event',
      triggerContext: { ticketId: 'tk1', ticket: { id: 'tk1', status: 'open' } },
    });
  });

  it('does nothing without active workflows or when the ticket is gone', async () => {
    const empty = deps([]);
    expect(await processWorkflowEvent({ orgId: 'o1', event: { eventType: 'created', recordId: 'tk1' } }, empty.deps)).toEqual([]);

    const d = deps([{ id: 'wf1', version: 1, publishedGraph: graphTriggering(['created']) }]);
    d.deps.getTicket = async () => undefined;
    expect(await processWorkflowEvent({ orgId: 'o1', event: { eventType: 'created', recordId: 'tk1' } }, d.deps)).toEqual([]);
  });
});

describe('applyTicketUpdate', () => {
  function deps(before: Record<string, unknown>): { deps: TicketActionDeps; patches: Record<string, unknown>[]; events: unknown[] } {
    const patches: Record<string, unknown>[] = [];
    const events: unknown[] = [];
    return {
      patches,
      events,
      deps: {
        getTicket: async () => before,
        patchTicket: async (_id, patch) => {
          patches.push(patch);
          return { ...before, ...patch };
        },
        recordActivity: async (e) => {
          events.push(e);
        },
      },
    };
  }

  it('merges data, stamps resolvedAt on resolve, and records the diff events', async () => {
    const d = deps({ id: 'tk1', status: 'open', priority: 'low', data: { keep: 1 } });
    const { ticket, updated } = await applyTicketUpdate(d.deps, 'tk1', { status: 'resolved', data: { reviewed: 'yes' } });

    expect(d.patches[0]).toMatchObject({ status: 'resolved', data: { keep: 1, reviewed: 'yes' } });
    expect(d.patches[0].resolvedAt).toBeInstanceOf(Date);
    expect(updated).toEqual(['status', 'data']);
    expect(ticket.status).toBe('resolved');
    expect(d.events).toContainEqual({
      ticketId: 'tk1',
      eventType: 'status',
      changes: { from: 'open', to: 'resolved' },
    });
    expect(d.events).toContainEqual({
      ticketId: 'tk1',
      eventType: 'field_changed',
      changes: { field: 'reviewed', from: null, to: 'yes' },
    });
  });

  it('throws when the ticket does not exist', async () => {
    const d = deps({ id: 'tk1' });
    d.deps.getTicket = async () => undefined;
    await expect(applyTicketUpdate(d.deps, 'tk1', { status: 'open' })).rejects.toThrow(/not found/);
  });
});
