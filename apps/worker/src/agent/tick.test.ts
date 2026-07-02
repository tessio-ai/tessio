// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, vi } from 'vitest';
import { runAgentOfflineTick } from './tick';

describe('runAgentOfflineTick', () => {
  it('marks devices stale before (now - staleAfterMs)', async () => {
    const now = new Date('2026-06-13T12:00:00.000Z');
    const markOfflineStale = vi.fn().mockResolvedValue(2);
    await runAgentOfflineTick({ now: () => now, staleAfterMs: 15 * 60_000, markOfflineStale });
    expect(markOfflineStale).toHaveBeenCalledWith(new Date('2026-06-13T11:45:00.000Z'));
  });

  it('swallows repo errors so the tick never crashes the worker', async () => {
    const markOfflineStale = vi.fn().mockRejectedValue(new Error('db down'));
    await expect(
      runAgentOfflineTick({ now: () => new Date(), staleAfterMs: 1000, markOfflineStale }),
    ).resolves.toBeUndefined();
  });
});
