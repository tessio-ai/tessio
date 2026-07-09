// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { progressStep, statusLabel, buildTimeline, PROGRESS_STEPS } from './progress';
import type { ActivityRow } from '../../api/activity';
import type { CommentRow } from '../../api/types';

const act = (over: Partial<ActivityRow>): ActivityRow => ({ id: 'a1', actorId: null, eventType: 'created', changes: null, createdAt: '2026-07-01T10:00:00Z', ...over });
const com = (over: Partial<CommentRow>): CommentRow => ({ id: 'c1', recordType: 'ticket', recordId: 't1', authorId: 'u1', body: 'hi', internal: false, createdAt: '2026-07-01T11:00:00Z', ...over });

describe('progressStep', () => {
  it('maps each lifecycle status to its journey stage', () => {
    expect(progressStep('new')).toBe(0);
    expect(progressStep('open')).toBe(0);
    expect(progressStep('in_progress')).toBe(1);
    expect(progressStep('pending')).toBe(1);
    expect(progressStep('on_hold')).toBe(1);
    expect(progressStep('resolved')).toBe(2);
    expect(progressStep('closed')).toBe(3);
  });

  it('treats a missing status as freshly submitted and unknown ones as in progress', () => {
    expect(progressStep(null)).toBe(0);
    expect(progressStep(undefined)).toBe(0);
    expect(progressStep('waiting_on_vendor')).toBe(1);
  });

  it('always returns a valid index into PROGRESS_STEPS', () => {
    for (const s of ['new', 'open', 'in_progress', 'resolved', 'closed', 'custom', null]) {
      const i = progressStep(s);
      expect(PROGRESS_STEPS[i]).toBeDefined();
    }
  });
});

describe('statusLabel', () => {
  it('humanizes snake_case statuses', () => {
    expect(statusLabel('in_progress')).toBe('In progress');
    expect(statusLabel('on_hold')).toBe('On hold');
    expect(statusLabel('resolved')).toBe('Resolved');
  });

  it('defaults a missing status to Open', () => {
    expect(statusLabel(null)).toBe('Open');
    expect(statusLabel('')).toBe('Open');
  });
});

describe('buildTimeline', () => {
  it('merges creation, status changes, and public comments in chronological order', () => {
    const activity = [
      act({ id: 'a2', eventType: 'status', changes: { from: 'open', to: 'in_progress' }, createdAt: '2026-07-02T09:00:00Z' }),
      act({ id: 'a1', eventType: 'created', createdAt: '2026-07-01T10:00:00Z' }),
    ];
    const comments = [com({ id: 'c1', createdAt: '2026-07-01T11:00:00Z' })];
    const tl = buildTimeline(activity, comments);
    expect(tl.map((e) => e.kind)).toEqual(['created', 'comment', 'status']);
    expect(tl[2]).toMatchObject({ kind: 'status', to: 'in_progress' });
  });

  it('drops internal-ops events and internal comments', () => {
    const activity = [
      act({ id: 'a1', eventType: 'created' }),
      act({ id: 'a2', eventType: 'assigned', changes: { from: null, to: 'agent-1' } }),
      act({ id: 'a3', eventType: 'priority', changes: { from: 'low', to: 'high' } }),
      act({ id: 'a4', eventType: 'field_changed', changes: { field: 'title', from: 'a', to: 'b' } }),
    ];
    const comments = [com({ id: 'c1', internal: true })];
    expect(buildTimeline(activity, comments)).toHaveLength(1);
  });

  it('handles a non-string status target', () => {
    const tl = buildTimeline([act({ eventType: 'status', changes: { to: 42 } })], []);
    expect(tl[0]).toMatchObject({ kind: 'status', to: null });
  });
});
