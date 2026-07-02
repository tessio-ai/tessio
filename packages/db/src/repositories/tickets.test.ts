// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { diffTicketActivity } from './tickets';

describe('diffTicketActivity', () => {
  it('emits one event per changed tracked system field', () => {
    const events = diffTicketActivity(
      { status: 'open', priority: 'low', assigneeId: null, teamId: 't1' },
      { status: 'resolved', priority: 'low', assigneeId: 'u1', teamId: 't1' },
    );
    expect(events).toEqual([
      { eventType: 'status', changes: { from: 'open', to: 'resolved' } },
      { eventType: 'assigned', changes: { from: null, to: 'u1' } },
    ]);
  });

  it('emits field_changed per changed data key (added, changed, removed)', () => {
    const events = diffTicketActivity(
      { data: { a: 1, b: 'x', gone: true } },
      { data: { a: 1, b: 'y', added: 'z' } },
    );
    expect(events).toContainEqual({ eventType: 'field_changed', changes: { field: 'b', from: 'x', to: 'y' } });
    expect(events).toContainEqual({ eventType: 'field_changed', changes: { field: 'gone', from: true, to: null } });
    expect(events).toContainEqual({ eventType: 'field_changed', changes: { field: 'added', from: null, to: 'z' } });
    expect(events).toHaveLength(3);
  });

  it('returns nothing when nothing changed', () => {
    expect(diffTicketActivity({ status: 'open', data: { a: 1 } }, { status: 'open', data: { a: 1 } })).toEqual([]);
  });
});
