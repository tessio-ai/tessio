// SPDX-License-Identifier: AGPL-3.0-only

import { it, expect, vi } from 'vitest';
import { runScheduleTick, type ScheduleDeps } from './tick';

function deps(over: Partial<ScheduleDeps> = {}): ScheduleDeps {
  return {
    now: () => new Date('2026-06-11T09:30:00Z'),
    loadScheduled: vi.fn(async () => [
      { id: 'due', orgId: 'o1', version: 2, cron: '0 9 * * *', timezone: 'UTC', lastFiredAt: new Date('2026-06-11T08:00:00Z'), graph: { nodes: [], edges: [] } },
      { id: 'fresh', orgId: 'o1', version: 1, cron: '0 9 * * *', timezone: 'UTC', lastFiredAt: null, graph: { nodes: [], edges: [] } },
      { id: 'notdue', orgId: 'o1', version: 1, cron: '0 9 * * *', timezone: 'UTC', lastFiredAt: new Date('2026-06-11T09:15:00Z'), graph: { nodes: [], edges: [] } },
    ]),
    createRun: vi.fn(async () => ({ id: 'run-1' })),
    enqueueRun: vi.fn(async () => {}),
    stampFired: vi.fn(async () => {}),
    ...over,
  };
}

it('fires due workflows, stamps fresh ones without running, leaves not-due alone', async () => {
  const d = deps();
  await runScheduleTick(d);
  expect(d.createRun).toHaveBeenCalledWith(expect.objectContaining({ workflowId: 'due', triggerKind: 'schedule' }));
  expect(d.enqueueRun).toHaveBeenCalledWith('o1', 'run-1');
  expect(d.stampFired).toHaveBeenCalledWith('due', expect.any(Date));
  expect(d.stampFired).toHaveBeenCalledWith('fresh', expect.any(Date));
  expect(d.createRun).toHaveBeenCalledTimes(1);
});

it('one workflow failing does not abort the batch', async () => {
  const d = deps({ createRun: vi.fn(async () => { throw new Error('boom'); }) });
  await expect(runScheduleTick(d)).resolves.toBeUndefined();
});
