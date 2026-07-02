// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { planToFilter, ALLOWED_ASK_FIELDS } from './to-filter';
import type { AskPlan } from './schema';

const base: AskPlan = { answerable: true, combine: 'and', conditions: [], limit: 20, title: 'x' };

describe('planToFilter', () => {
  it('builds an AND FilterNode from leaves', () => {
    const { filter } = planToFilter({ ...base, conditions: [
      { field: 'status', op: 'in', value: ['open', 'in_progress'] },
      { field: 'priority', op: 'eq', value: ['high'] },
    ] });
    expect(filter).toEqual({ and: [
      { field: 'status', op: 'in', value: ['open', 'in_progress'] },
      { field: 'priority', op: 'eq', value: 'high' },
    ] });
  });

  it('expands the `unassigned` pseudo-field to assigneeId isNull', () => {
    const { filter } = planToFilter({ ...base, conditions: [{ field: 'unassigned', op: 'eq', value: [] }] });
    expect(filter).toEqual({ and: [{ field: 'assigneeId', op: 'isNull' }] });
  });

  it('allows data.<key> fields', () => {
    const { filter } = planToFilter({ ...base, conditions: [{ field: 'data.category', op: 'eq', value: ['Hardware'] }] });
    expect(filter).toEqual({ and: [{ field: 'data.category', op: 'eq', value: 'Hardware' }] });
  });

  it('drops unknown / unsafe fields', () => {
    const { filter } = planToFilter({ ...base, conditions: [
      { field: 'secret_column', op: 'eq', value: ['x'] },
      { field: 'data.bad-key', op: 'eq', value: ['x'] },
    ] });
    expect(filter).toBeNull();
  });

  it('returns null when not answerable', () => {
    expect(planToFilter({ ...base, answerable: false, conditions: [{ field: 'status', op: 'eq', value: ['open'] }] }).filter).toBeNull();
  });

  it('whitelist contains the curated ticket fields', () => {
    expect(ALLOWED_ASK_FIELDS).toContain('status');
    expect(ALLOWED_ASK_FIELDS).toContain('dueAt');
    expect(ALLOWED_ASK_FIELDS).toContain('assigneeId');
  });

  it('uses an OR FilterNode when combine is or', () => {
    const { filter } = planToFilter({ ...base, combine: 'or', conditions: [
      { field: 'status', op: 'eq', value: ['open'] },
      { field: 'priority', op: 'eq', value: ['high'] },
    ] });
    expect(filter).toEqual({ or: [
      { field: 'status', op: 'eq', value: 'open' },
      { field: 'priority', op: 'eq', value: 'high' },
    ] });
  });

  it('drops a scalar condition with an empty value array', () => {
    const { filter } = planToFilter({ ...base, conditions: [{ field: 'status', op: 'eq', value: [] }] });
    expect(filter).toBeNull();
  });
});
