// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { computeDue, type ScheduledWorkflow } from './due';

const wf = (over: Partial<ScheduledWorkflow> = {}): ScheduledWorkflow =>
  ({ id: 'w', cron: '0 9 * * *', timezone: 'UTC', lastFiredAt: new Date('2026-06-11T08:00:00Z'), ...over });

describe('computeDue', () => {
  it('fires when a cron occurrence falls in (lastFiredAt, now]', () => {
    const due = computeDue([wf()], new Date('2026-06-11T09:30:00Z'));
    expect(due).toEqual([{ workflowId: 'w', firedAt: new Date('2026-06-11T09:30:00Z') }]);
  });
  it('does not fire when no occurrence elapsed', () => {
    expect(computeDue([wf()], new Date('2026-06-11T08:30:00Z'))).toEqual([]);
  });
  it('never fires when lastFiredAt is null (baseline is stamped by the caller)', () => {
    expect(computeDue([wf({ lastFiredAt: null })], new Date('2026-06-11T09:30:00Z'))).toEqual([]);
  });
  it('skips an invalid cron without throwing', () => {
    expect(computeDue([wf({ cron: 'nope' })], new Date('2026-06-11T10:00:00Z'))).toEqual([]);
  });
  it('respects timezone', () => {
    // 09:00 America/New_York on 2026-06-11 = 13:00Z. Window crossing it fires.
    const w = wf({ timezone: 'America/New_York', lastFiredAt: new Date('2026-06-11T12:00:00Z') });
    expect(computeDue([w], new Date('2026-06-11T13:30:00Z'))).toEqual([{ workflowId: 'w', firedAt: new Date('2026-06-11T13:30:00Z') }]);
  });
});
