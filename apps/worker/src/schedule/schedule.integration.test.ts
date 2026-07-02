// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import {
  createTestDb,
  resetDb,
  seedOrgAndSchema,
} from '@tessio/db/testing';
import { workflowsRepo } from '@tessio/db';
import { buildScheduleDeps } from './wire';
import { runScheduleTick } from './tick';
import type { WorkflowGraph } from '@tessio/shared';

// ---------------------------------------------------------------------------
// Shared DB
// ---------------------------------------------------------------------------
const db = createTestDb();

beforeEach(async () => {
  await resetDb(db);
});

afterAll(async () => {
  await db.$client.end();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A published graph with a schedule trigger + one script node. */
function scheduledGraph(): WorkflowGraph {
  return {
    nodes: [
      {
        id: 'trigger',
        type: 'trigger',
        name: 'Schedule',
        position: { x: 80, y: 200 },
        config: {
          events: [],
          schedule: { cron: '0 9 * * *', timezone: 'UTC' },
        },
      },
      {
        id: 'script1',
        type: 'script',
        name: 'Script',
        position: { x: 80, y: 400 },
        config: { code: 'return 1;' },
      },
    ],
    edges: [{ id: 'e1', from: 'trigger', to: 'script1' }],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('runScheduleTick — integration', () => {
  it('creates a schedule run and advances scheduleLastFiredAt when a cron occurrence is due', async () => {
    // -----------------------------------------------------------------------
    // 1. Seed org (schema not strictly required for workflow creation but mirrors
    //    the standard harness pattern used by other integration tests).
    // -----------------------------------------------------------------------
    const { orgId } = await seedOrgAndSchema(db, 'ticket');

    // -----------------------------------------------------------------------
    // 2. Create workflow with draft graph, then publish to get an active workflow
    //    with a publishedGraph, then stamp scheduleLastFiredAt so the 09:00 UTC
    //    occurrence on 2026-06-11 falls between lastFiredAt (08:00) and now (09:30).
    // -----------------------------------------------------------------------
    const graph = scheduledGraph();

    const repo = workflowsRepo(db);

    // Create with the graph already set so publish copies it over.
    const wf = await repo.create({ orgId, name: 'Daily 9am workflow', graph });

    // Publish: copies graph → publishedGraph, bumps version, sets status active.
    const published = await repo.publish(orgId, wf.id);
    expect(published.status).toBe('active');
    expect(published.publishedGraph).toBeTruthy();

    // Set scheduleLastFiredAt to 08:00 UTC so the 09:00 occurrence is due at 09:30.
    // stampScheduleFired is the repo method that updates scheduleLastFiredAt.
    const watermarkBefore = new Date('2026-06-11T08:00:00Z');
    await repo.stampScheduleFired(wf.id, watermarkBefore);

    // -----------------------------------------------------------------------
    // 3. Build deps: real DB, fake queue (no Redis), fixed "now" = 09:30 UTC.
    // -----------------------------------------------------------------------
    const fixedNow = new Date('2026-06-11T09:30:00Z');
    const fakeRunsQueue = { add: async () => {} } as never;

    const deps = {
      ...buildScheduleDeps(db, fakeRunsQueue),
      now: () => fixedNow,
    };

    // -----------------------------------------------------------------------
    // 4. Run the tick.
    // -----------------------------------------------------------------------
    await runScheduleTick(deps);

    // -----------------------------------------------------------------------
    // 5a. A workflow_runs row exists for this workflow with triggerKind = 'schedule'.
    // -----------------------------------------------------------------------
    const runs = await repo.listRuns(orgId, wf.id);
    expect(runs).toHaveLength(1);
    expect(runs[0].triggerKind).toBe('schedule');
    expect(runs[0].workflowId).toBe(wf.id);

    // -----------------------------------------------------------------------
    // 5b. scheduleLastFiredAt advanced to the fixed "now" (09:30 UTC).
    // -----------------------------------------------------------------------
    const updated = await repo.getById(orgId, wf.id);
    expect(updated).toBeDefined();
    expect(updated!.scheduleLastFiredAt).toEqual(fixedNow);
  });
});
