// SPDX-License-Identifier: AGPL-3.0-only

import { it, expect, vi } from 'vitest';
import { runSlaTick, type SlaDeps } from './tick';
import type { SlaCandidate } from './breaches';

const BASE: SlaCandidate = {
  id: 'ticket-1',
  orgId: 'org-1',
  number: 42,
  assigneeId: 'user-1',
  teamId: 'team-1',
  slaResponseDueAt: null,
  firstRespondedAt: null,
  slaResponseBreachedAt: null,
  slaResolutionDueAt: null,
  resolvedAt: null,
  slaResolutionBreachedAt: null,
};

const NOW = new Date('2026-06-11T12:00:00Z');
const DUE_PAST = new Date('2026-06-11T11:00:00Z');

function deps(over: Partial<SlaDeps> = {}): SlaDeps {
  return {
    now: () => NOW,
    loadCandidates: vi.fn(async () => []),
    stampBreach: vi.fn(async () => {}),
    notify: vi.fn(async () => {}),
    ...over,
  };
}

it('stamps and notifies for a response-breach candidate', async () => {
  const candidate: SlaCandidate = {
    ...BASE,
    slaResponseDueAt: DUE_PAST,
    // firstRespondedAt null, slaResponseBreachedAt null → will breach
  };
  const d = deps({ loadCandidates: vi.fn(async () => [candidate]) });

  await runSlaTick(d);

  expect(d.stampBreach).toHaveBeenCalledWith('ticket-1', 'response', NOW);
  expect(d.notify).toHaveBeenCalledWith(
    expect.objectContaining({ kind: 'response', ticketId: 'ticket-1' }),
  );
});

it('stamps and notifies for a resolution-breach candidate', async () => {
  const candidate: SlaCandidate = {
    ...BASE,
    id: 'ticket-2',
    slaResolutionDueAt: DUE_PAST,
    // resolvedAt null, slaResolutionBreachedAt null → will breach
  };
  const d = deps({ loadCandidates: vi.fn(async () => [candidate]) });

  await runSlaTick(d);

  expect(d.stampBreach).toHaveBeenCalledWith('ticket-2', 'resolution', NOW);
  expect(d.notify).toHaveBeenCalledWith(
    expect.objectContaining({ kind: 'resolution', ticketId: 'ticket-2' }),
  );
});

it('does not stamp or notify for a candidate that is already responded/resolved', async () => {
  const alreadyResponded: SlaCandidate = {
    ...BASE,
    id: 'ticket-3',
    slaResponseDueAt: DUE_PAST,
    firstRespondedAt: new Date('2026-06-11T10:00:00Z'), // responded before due
  };
  const alreadyResolved: SlaCandidate = {
    ...BASE,
    id: 'ticket-4',
    slaResolutionDueAt: DUE_PAST,
    resolvedAt: new Date('2026-06-11T10:00:00Z'),
  };
  const d = deps({ loadCandidates: vi.fn(async () => [alreadyResponded, alreadyResolved]) });

  await runSlaTick(d);

  expect(d.stampBreach).not.toHaveBeenCalled();
  expect(d.notify).not.toHaveBeenCalled();
});

it('stampBreach throwing for one ticket does not abort the batch', async () => {
  const candidate: SlaCandidate = {
    ...BASE,
    slaResponseDueAt: DUE_PAST,
  };
  const d = deps({
    loadCandidates: vi.fn(async () => [candidate]),
    stampBreach: vi.fn(async () => { throw new Error('db error'); }),
  });

  await expect(runSlaTick(d)).resolves.toBeUndefined();
});
