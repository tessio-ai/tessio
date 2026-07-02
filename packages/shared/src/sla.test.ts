// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { computeSlaTargets, slaTargetsSchema } from './sla';
const targets = { high: { responseMins: 60, resolutionMins: 240 }, low: { responseMins: 480, resolutionMins: 2880 } };
describe('computeSlaTargets', () => {
  it('computes response + resolution due from createdAt', () => {
    expect(computeSlaTargets(new Date('2026-06-11T09:00:00Z'), 'high', targets)).toEqual({
      responseDueAt: new Date('2026-06-11T10:00:00Z'), resolutionDueAt: new Date('2026-06-11T13:00:00Z') });
  });
  it('returns null for a priority with no target', () => {
    expect(computeSlaTargets(new Date(), 'urgent', targets)).toBeNull();
    expect(computeSlaTargets(new Date(), null, targets)).toBeNull();
  });
});
describe('slaTargetsSchema', () => {
  it('accepts valid targets and rejects non-positive', () => {
    expect(slaTargetsSchema.safeParse(targets).success).toBe(true);
    expect(slaTargetsSchema.safeParse({ high: { responseMins: 0, resolutionMins: 10 } }).success).toBe(false);
  });
});
