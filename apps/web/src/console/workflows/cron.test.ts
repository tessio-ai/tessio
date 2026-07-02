// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { nextRuns, CRON_PRESETS } from './cron';

describe('nextRuns', () => {
  it('returns n ascending future dates for a valid cron', () => {
    const runs = nextRuns('0 9 * * *', 'UTC', 2);
    expect(runs).toHaveLength(2);
    expect(runs[1].getTime()).toBeGreaterThan(runs[0].getTime());
  });
  it('returns [] for an invalid cron', () => {
    expect(nextRuns('not a cron', 'UTC')).toEqual([]);
  });
  it('exposes presets', () => {
    expect(CRON_PRESETS.length).toBeGreaterThan(0);
    expect(CRON_PRESETS[0]).toHaveProperty('cron');
  });
});
