// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { computeBreaches, type SlaCandidate } from './breaches';
const now = new Date('2026-06-11T12:00:00Z');
const base: SlaCandidate = { id: 't', orgId: 'o', number: 1, assigneeId: 'a', teamId: null,
  slaResponseDueAt: null, firstRespondedAt: null, slaResponseBreachedAt: null,
  slaResolutionDueAt: null, resolvedAt: null, slaResolutionBreachedAt: null };
describe('computeBreaches', () => {
  it('flags a response breach when due passed, unresponded, unbreached', () => {
    const r = computeBreaches([{ ...base, slaResponseDueAt: new Date('2026-06-11T11:00:00Z') }], now);
    expect(r.response.map(t => t.id)).toEqual(['t']); expect(r.resolution).toEqual([]);
  });
  it('no response breach once responded', () => {
    expect(computeBreaches([{ ...base, slaResponseDueAt: new Date('2026-06-11T11:00:00Z'), firstRespondedAt: now }], now).response).toEqual([]);
  });
  it('no response breach once already breached', () => {
    expect(computeBreaches([{ ...base, slaResponseDueAt: new Date('2026-06-11T11:00:00Z'), slaResponseBreachedAt: now }], now).response).toEqual([]);
  });
  it('flags a resolution breach when due passed + unresolved', () => {
    expect(computeBreaches([{ ...base, slaResolutionDueAt: new Date('2026-06-11T11:00:00Z') }], now).resolution.map(t=>t.id)).toEqual(['t']);
  });
  it('no resolution breach once resolved', () => {
    expect(computeBreaches([{ ...base, slaResolutionDueAt: new Date('2026-06-11T11:00:00Z'), resolvedAt: now }], now).resolution).toEqual([]);
  });
});
