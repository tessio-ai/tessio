// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { triageResultSchema } from './features/triage';

describe('triageResultSchema', () => {
  it('accepts a valid result', () => {
    const parsed = triageResultSchema.parse({
      category: 'Hardware',
      priority: 'high',
      suggestedAssigneeId: 'u1',
      confidence: 0.82,
      reasoning: 'Printer hardware fault affecting a floor.',
    });
    expect(parsed.priority).toBe('high');
  });

  it('allows a null assignee', () => {
    const parsed = triageResultSchema.parse({
      category: 'Other',
      priority: 'low',
      suggestedAssigneeId: null,
      confidence: 0.3,
      reasoning: 'Unclear.',
    });
    expect(parsed.suggestedAssigneeId).toBeNull();
  });

  it('rejects an invalid priority', () => {
    expect(() =>
      triageResultSchema.parse({ category: 'x', priority: 'critical', suggestedAssigneeId: null, confidence: 0.5, reasoning: 'x' }),
    ).toThrow();
  });
});
