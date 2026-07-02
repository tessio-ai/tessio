// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { filterNode, sortField, comparisonOp } from './filter';

describe('filterNode AST', () => {
  it('parses a nested and/or/not tree of leaves', () => {
    const parsed = filterNode.parse({
      and: [
        { field: 'status', op: 'eq', value: 'open' },
        {
          or: [
            { field: 'priority', op: 'eq', value: 'high' },
            { not: { field: 'assigneeId', op: 'isNull' } },
          ],
        },
      ],
    });
    expect(parsed).toBeTruthy();
  });

  it('parses a JSONB-path leaf with a type hint', () => {
    const parsed = filterNode.parse({ field: 'data.cost', op: 'gt', value: 100, type: 'number' });
    expect(parsed).toEqual({ field: 'data.cost', op: 'gt', value: 100, type: 'number' });
  });

  it('rejects an empty and[] group', () => {
    expect(() => filterNode.parse({ and: [] })).toThrow();
  });

  it('rejects a leaf missing its op', () => {
    expect(() => filterNode.parse({ field: 'status' })).toThrow();
  });

  it('exposes the comparison operators', () => {
    expect(comparisonOp.options).toEqual(
      expect.arrayContaining(['eq', 'ne', 'lt', 'lte', 'gt', 'gte', 'in', 'contains', 'startsWith', 'isNull']),
    );
  });

  it('defaults sort direction to asc', () => {
    expect(sortField.parse({ field: 'createdAt' }).dir).toBe('asc');
  });
});
