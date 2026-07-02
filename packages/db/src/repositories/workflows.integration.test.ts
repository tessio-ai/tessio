// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { createTestDb, resetDb, seedOrgAndSchema } from '../testing/test-db';
import { workflowsRepo, starterGraph } from './workflows';
import type { WorkflowGraph } from '@tessio/shared';

const db = createTestDb();
const repo = workflowsRepo(db);

const graph: WorkflowGraph = {
  nodes: [
    { id: 'trigger', type: 'trigger', position: { x: 0, y: 0 }, config: { events: ['created'] } },
    { id: 'c1', type: 'add_comment', position: { x: 200, y: 0 }, config: { body: 'hello' } },
  ],
  edges: [{ id: 'e1', from: 'trigger', to: 'c1' }],
};

describe('workflowsRepo', () => {
  let orgId: string;

  beforeEach(async () => {
    await resetDb(db);
    ({ orgId } = await seedOrgAndSchema(db, 'ticket'));
  });
  afterAll(async () => {
    await db.$client.end();
  });

  it('creates a draft with the starter graph and lists it', async () => {
    const wf = await repo.create({ orgId, name: 'My workflow' });
    expect(wf.status).toBe('draft');
    expect(wf.version).toBe(0);
    expect(wf.graph).toEqual(starterGraph());
    expect(wf.publishedGraph).toBeNull();
    expect(await repo.list(orgId)).toHaveLength(1);
  });

  it('publish copies the draft graph, bumps version, and activates a draft', async () => {
    const wf = await repo.create({ orgId, name: 'wf', graph });
    const published = await repo.publish(orgId, wf.id);
    expect(published.status).toBe('active');
    expect(published.version).toBe(1);
    expect(published.publishedGraph).toEqual(graph);

    // Draft edits don't touch the published graph until the next publish.
    const edited: WorkflowGraph = { ...graph, edges: [] };
    await repo.update(orgId, wf.id, { graph: edited });
    const reloaded = await repo.getById(orgId, wf.id);
    expect(reloaded.publishedGraph).toEqual(graph);
    const republished = await repo.publish(orgId, wf.id);
    expect(republished.version).toBe(2);
    expect(republished.publishedGraph).toEqual(edited);
  });

  it('publish keeps a paused workflow paused', async () => {
    const wf = await repo.create({ orgId, name: 'wf', graph });
    await repo.publish(orgId, wf.id);
    await repo.setStatus(orgId, wf.id, 'paused');
    const republished = await repo.publish(orgId, wf.id);
    expect(republished.status).toBe('paused');
  });

  it('listActive / hasActive only see active workflows with a published graph', async () => {
    const draft = await repo.create({ orgId, name: 'draft', graph });
    expect(await repo.hasActive(orgId)).toBe(false);
    await repo.publish(orgId, draft.id);
    expect(await repo.hasActive(orgId)).toBe(true);
    expect(await repo.listActive(orgId)).toHaveLength(1);
    await repo.setStatus(orgId, draft.id, 'paused');
    expect(await repo.listActive(orgId)).toHaveLength(0);
    expect(await repo.hasActive(orgId)).toBe(false);
  });

  it('is org-scoped', async () => {
    const other = await seedOrgAndSchema(db, 'ticket');
    const wf = await repo.create({ orgId, name: 'mine' });
    expect(await repo.getById(other.orgId, wf.id)).toBeUndefined();
    expect(await repo.list(other.orgId)).toHaveLength(0);
  });

  it('runs and node runs round-trip with newest-first listing', async () => {
    const wf = await repo.create({ orgId, name: 'wf', graph });
    const published = await repo.publish(orgId, wf.id);

    const run = await repo.createRun({
      orgId,
      workflowId: wf.id,
      workflowVersion: published.version,
      triggerKind: 'manual',
      triggerContext: { ticketId: 'abc' },
      graph: published.publishedGraph as WorkflowGraph,
    });
    expect(run.status).toBe('queued');

    await repo.updateRun(run.id, { status: 'running', startedAt: new Date() });
    const nodeRun = await repo.createNodeRun({ runId: run.id, nodeId: 'c1', input: { body: 'hello' } });
    await repo.updateNodeRun(nodeRun.id, { status: 'completed', output: { commentId: 'x' }, finishedAt: new Date() });
    await repo.updateRun(run.id, { status: 'completed', finishedAt: new Date(), context: { nodes: {} } });

    const second = await repo.createRun({
      orgId,
      workflowId: wf.id,
      workflowVersion: published.version,
      triggerKind: 'event',
      triggerContext: {},
      graph: published.publishedGraph as WorkflowGraph,
    });

    const runs = await repo.listRuns(orgId, wf.id);
    expect(runs.map((r) => r.id)).toEqual([second.id, run.id]);

    const reloaded = await repo.getRun(orgId, run.id);
    expect(reloaded.status).toBe('completed');
    const nodeRuns = await repo.listNodeRuns(run.id);
    expect(nodeRuns).toHaveLength(1);
    expect(nodeRuns[0].status).toBe('completed');
    expect(nodeRuns[0].output).toEqual({ commentId: 'x' });
  });
});
