// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, vi } from 'vitest';
import { runAsk, type AskDeps } from './ask-core';
import type { AskPlan } from '@tessio/ai';

const okPlan: AskPlan = { answerable: true, combine: 'and', conditions: [{ field: 'unassigned', op: 'eq', value: [] }], limit: 20, title: 'Unassigned' };

function deps(overrides: Partial<AskDeps> = {}): AskDeps {
  return {
    plan: vi.fn().mockResolvedValue(okPlan),
    queryTickets: vi.fn().mockResolvedValue([
      { id: 't1', number: 3, status: 'open', priority: 'high', assigneeId: null, dueAt: null, data: { title: 'VPN down', category: 'Access' } },
    ]),
    answer: vi.fn().mockResolvedValue('Found #3.'),
    ...overrides,
  };
}

describe('runAsk', () => {
  it('queries with the planned filter (clamped) and returns answer + ticket refs', async () => {
    const d = deps();
    const res = await runAsk(d, { query: 'unassigned tickets' });
    expect(d.queryTickets).toHaveBeenCalledWith({ and: [{ field: 'assigneeId', op: 'isNull' }] }, 20);
    expect(res.answer).toBe('Found #3.');
    expect(res.tickets).toEqual([{ number: 3, id: 't1', title: 'VPN down', status: 'open' }]);
  });

  it('clamps the limit to 50', async () => {
    const d = deps({ plan: vi.fn().mockResolvedValue({ ...okPlan, limit: 999 }) });
    await runAsk(d, { query: 'x' });
    expect(d.queryTickets).toHaveBeenCalledWith(expect.anything(), 50);
  });

  it('returns a capability hint without querying when not answerable', async () => {
    const d = deps({ plan: vi.fn().mockResolvedValue({ ...okPlan, answerable: false }) });
    const res = await runAsk(d, { query: 'tell me a joke' });
    expect(d.queryTickets).not.toHaveBeenCalled();
    expect(res.tickets).toEqual([]);
    expect(res.answer).toMatch(/search|summarize|tickets/i);
  });

  it('skips the answer call when no tickets match', async () => {
    const d = deps({ queryTickets: vi.fn().mockResolvedValue([]) });
    const res = await runAsk(d, { query: 'unassigned tickets' });
    expect(d.answer).not.toHaveBeenCalled();
    expect(res.tickets).toEqual([]);
  });
});
