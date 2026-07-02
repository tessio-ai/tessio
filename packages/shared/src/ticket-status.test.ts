// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { statusTimestamps } from './ticket-status';

const NOW = new Date('2026-06-09T10:00:00.000Z');

describe('statusTimestamps', () => {
  it('stamps resolvedAt when entering resolved', () => {
    expect(statusTimestamps('open', 'resolved', NOW)).toEqual({ resolvedAt: NOW });
  });

  it('stamps closedAt when entering closed (leaving resolvedAt intact)', () => {
    expect(statusTimestamps('resolved', 'closed', NOW)).toEqual({ closedAt: NOW });
  });

  it('clears both stamps when reopened to an active state', () => {
    expect(statusTimestamps('resolved', 'open', NOW)).toEqual({ resolvedAt: null, closedAt: null });
    expect(statusTimestamps('closed', 'in_progress', NOW)).toEqual({ resolvedAt: null, closedAt: null });
  });

  it('does nothing when the status is unchanged', () => {
    expect(statusTimestamps('resolved', 'resolved', NOW)).toEqual({});
  });

  it('does nothing when the patch has no (string) status', () => {
    expect(statusTimestamps('open', undefined, NOW)).toEqual({});
    expect(statusTimestamps('open', null, NOW)).toEqual({});
  });
});
