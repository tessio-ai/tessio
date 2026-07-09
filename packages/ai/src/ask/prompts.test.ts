// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { buildPlanPrompt, buildAnswerPrompt, dateAnchors } from './prompts';

describe('dateAnchors', () => {
  it('computes UTC boundaries from now (Tue 2026-06-09)', () => {
    const a = dateAnchors('2026-06-09T04:45:00.000Z');
    expect(a.startOfToday).toBe('2026-06-09T00:00:00.000Z');
    expect(a.startOfWeek).toBe('2026-06-08T00:00:00.000Z'); // Monday of that week
    expect(a.startOfMonth).toBe('2026-06-01T00:00:00.000Z');
    expect(a.sevenDaysAgo).toBe('2026-06-02T04:45:00.000Z');
    expect(a.thirtyDaysAgo).toBe('2026-05-10T04:45:00.000Z');
  });

  it('treats Sunday as the end of the week (Monday start)', () => {
    const a = dateAnchors('2026-06-07T12:00:00.000Z'); // a Sunday
    expect(a.startOfWeek).toBe('2026-06-01T00:00:00.000Z'); // previous Monday
  });
});

describe('ask prompts', () => {
  it('plan prompt includes the request, the allowed fields, and the current time', () => {
    const { system, prompt } = buildPlanPrompt({ query: 'unassigned hardware tickets', now: '2026-06-08T12:00:00Z' });
    expect(prompt).toContain('unassigned hardware tickets');
    expect(prompt).toContain('2026-06-08T12:00:00Z');
    expect(system + prompt).toContain('status');
    expect(system + prompt).toContain('unassigned');
  });

  it('plan prompt enumerates the status enum and routes category terms to data.category with contains', () => {
    const { system, prompt } = buildPlanPrompt({ query: 'hardware tickets', now: '2026-06-08T12:00:00Z' });
    const text = system + prompt;
    // status is a fixed enum — so the model cannot mistake a category word (e.g. "hardware") for a status
    expect(text).toContain('in_progress');
    expect(text).toContain('on_hold');
    // category/type terms must be routed to data.category, matched case-insensitively
    expect(text).toContain('data.category');
    expect(text).toMatch(/contains/);
  });

  it('plan prompt supplies date anchors, few-shot examples, and the resolvedAt caveat', () => {
    const { prompt } = buildPlanPrompt({ query: 'resolved tickets from this week', now: '2026-06-09T04:45:00.000Z' });
    // concrete anchors so the model never does date math
    expect(prompt).toContain('start of this week (Monday): 2026-06-08T00:00:00.000Z');
    expect(prompt).toContain('start of today: 2026-06-09T00:00:00.000Z');
    // few-shot examples present
    expect(prompt).toContain('Examples (request -> conditions):');
    expect(prompt).toContain('overdue');
    // resolvedAt/closedAt are unreliable — steer temporal filters to updatedAt
    expect(prompt).toMatch(/resolvedAt.*EMPTY|do NOT filter on these/);
  });

  it('plan and answer prompts speak as the personalized bot name (default Tess)', () => {
    expect(buildPlanPrompt({ query: 'q', now: '2026-06-08T12:00:00Z' }).system).toContain('You are Tess,');
    expect(buildPlanPrompt({ query: 'q', now: '2026-06-08T12:00:00Z', botName: 'Max' }).system).toContain('You are Max,');
    expect(buildAnswerPrompt({ query: 'q', tickets: [] }).system).toContain('You are Tess.');
    expect(buildAnswerPrompt({ query: 'q', tickets: [], botName: 'Max' }).system).toContain('You are Max.');
  });

  it('answer prompt lists the fetched tickets by number and demands grounding', () => {
    const { system, prompt } = buildAnswerPrompt({
      query: "what's open?",
      tickets: [{ number: 3, title: 'VPN down', status: 'open', priority: 'high', assigned: false, dueAt: null, category: 'Access' }],
    });
    expect(prompt).toContain('#3');
    expect(prompt).toContain('VPN down');
    expect(system).toMatch(/only.*provided|do not invent|grounded/i);
  });
});
