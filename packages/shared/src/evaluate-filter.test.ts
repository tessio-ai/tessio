// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { evaluateFilter, evaluateFilterDeep } from './evaluate-filter';

describe('evaluateFilter', () => {
  it('evaluates eq / ne', () => {
    expect(evaluateFilter({ field: 'a', op: 'eq', value: 1 }, { a: 1 })).toBe(true);
    expect(evaluateFilter({ field: 'a', op: 'ne', value: 1 }, { a: 2 })).toBe(true);
  });

  it('evaluates comparisons', () => {
    expect(evaluateFilter({ field: 'n', op: 'gt', value: 5 }, { n: 6 })).toBe(true);
    expect(evaluateFilter({ field: 'n', op: 'lte', value: 5 }, { n: 5 })).toBe(true);
    expect(evaluateFilter({ field: 'n', op: 'lt', value: 5 }, { n: 5 })).toBe(false);
    expect(evaluateFilter({ field: 'n', op: 'gte', value: 5 }, { n: 5 })).toBe(true);
  });

  it('evaluates in / contains / startsWith / isNull', () => {
    expect(evaluateFilter({ field: 's', op: 'in', value: ['x', 'y'] }, { s: 'y' })).toBe(true);
    expect(evaluateFilter({ field: 's', op: 'contains', value: 'ell' }, { s: 'hello' })).toBe(true);
    expect(evaluateFilter({ field: 's', op: 'startsWith', value: 'he' }, { s: 'hello' })).toBe(true);
    expect(evaluateFilter({ field: 's', op: 'isNull' }, {})).toBe(true);
  });

  it('evaluates and / or / not trees', () => {
    const node = {
      and: [
        { field: 'a', op: 'eq' as const, value: 1 },
        { or: [{ field: 'b', op: 'eq' as const, value: 2 }, { not: { field: 'c', op: 'isNull' as const } }] },
      ],
    };
    expect(evaluateFilter(node, { a: 1, b: 2 })).toBe(true);
    expect(evaluateFilter(node, { a: 1, b: 9, c: undefined })).toBe(false);
    // `not isNull(c)` is the deciding true branch here.
    expect(evaluateFilter(node, { a: 1, b: 9, c: 42 })).toBe(true);
  });
});

describe('evaluateFilterDeep', () => {
  const scope = {
    ticket: { status: 'open', data: { category: 'hw', count: 5 } },
    nodes: { http: { output: { status: 200 } } },
  };

  it('resolves leaf fields as dot paths into the scope', () => {
    expect(evaluateFilterDeep({ field: 'ticket.status', op: 'eq', value: 'open' }, scope)).toBe(true);
    expect(evaluateFilterDeep({ field: 'ticket.data.category', op: 'eq', value: 'hw' }, scope)).toBe(true);
    expect(evaluateFilterDeep({ field: 'nodes.http.output.status', op: 'lt', value: 300 }, scope)).toBe(true);
  });

  it('treats missing paths as null for isNull', () => {
    expect(evaluateFilterDeep({ field: 'ticket.data.missing', op: 'isNull' }, scope)).toBe(true);
  });

  it('evaluates boolean trees over paths', () => {
    expect(
      evaluateFilterDeep(
        { and: [{ field: 'ticket.status', op: 'eq', value: 'open' }, { not: { field: 'ticket.data.count', op: 'gt', value: 10 } }] },
        scope,
      ),
    ).toBe(true);
  });
});
