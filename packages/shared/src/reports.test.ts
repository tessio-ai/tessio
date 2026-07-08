// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import {
  reportDefinition,
  REPORT_MEASURES,
  REPORT_DIMENSIONS,
  findMeasure,
  findDimension,
  isDataField,
} from './reports';

describe('reportDefinition schema', () => {
  it('parses a valid definition with defaults', () => {
    const result = reportDefinition.safeParse({
      source: 'tickets',
      measure: { id: 'count' },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.visualization).toBe('table');
    }
  });

  it('applies dateRange.field default of createdAt', () => {
    const result = reportDefinition.safeParse({
      source: 'tickets',
      measure: { id: 'count' },
      dateRange: { preset: '30d' },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dateRange?.field).toBe('createdAt');
    }
  });

  it('parses a full definition', () => {
    const result = reportDefinition.safeParse({
      source: 'tickets',
      measure: { id: 'avg_resolution_hours' },
      groupBy: { field: 'status', limit: 10 },
      filter: { field: 'status', op: 'eq', value: 'open' },
      dateRange: { field: 'resolvedAt', preset: '30d' },
      visualization: 'bar',
    });
    expect(result.success).toBe(true);
  });

  it('rejects unknown visualization', () => {
    const result = reportDefinition.safeParse({
      source: 'tickets',
      measure: { id: 'count' },
      visualization: 'unknown_viz',
    });
    expect(result.success).toBe(false);
  });

  it('rejects unknown source', () => {
    const result = reportDefinition.safeParse({
      source: 'users',
      measure: { id: 'count' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid measure.fn value', () => {
    const result = reportDefinition.safeParse({
      source: 'tickets',
      measure: { id: 'data.x', fn: 'count' },
    });
    expect(result.success).toBe(false);
  });

  it('accepts a valid measure.fn value', () => {
    const result = reportDefinition.safeParse({
      source: 'tickets',
      measure: { id: 'data.x', fn: 'avg' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects groupBy.limit of 51 (> max 50)', () => {
    const result = reportDefinition.safeParse({
      source: 'tickets',
      measure: { id: 'count' },
      groupBy: { field: 'status', limit: 51 },
    });
    expect(result.success).toBe(false);
  });

  it('accepts groupBy.limit of 50', () => {
    const result = reportDefinition.safeParse({
      source: 'tickets',
      measure: { id: 'count' },
      groupBy: { field: 'status', limit: 50 },
    });
    expect(result.success).toBe(true);
  });
});

describe('REPORT_MEASURES catalog', () => {
  it('has 14 entries', () => {
    expect(REPORT_MEASURES.length).toBe(14);
  });

  it('every measure has id, label, and fn', () => {
    for (const m of REPORT_MEASURES) {
      expect(m.id).toBeTruthy();
      expect(m.label).toBeTruthy();
      expect(m.fn).toBeTruthy();
    }
  });
});

describe('REPORT_DIMENSIONS catalog', () => {
  it('is non-empty', () => {
    expect(REPORT_DIMENSIONS.length).toBeGreaterThan(0);
  });

  it('every dimension has id, label, and kind', () => {
    for (const d of REPORT_DIMENSIONS) {
      expect(d.id).toBeTruthy();
      expect(d.label).toBeTruthy();
      expect(d.kind).toBeTruthy();
    }
  });
});

describe('findMeasure / findDimension', () => {
  it('findMeasure("count") resolves', () => {
    const m = findMeasure('count');
    expect(m).toBeDefined();
    expect(m?.id).toBe('count');
  });

  it('findMeasure returns undefined for unknown id', () => {
    expect(findMeasure('nonexistent')).toBeUndefined();
  });

  it('findDimension("status") resolves', () => {
    const d = findDimension('status');
    expect(d).toBeDefined();
    expect(d?.id).toBe('status');
  });

  it('findDimension returns undefined for unknown id', () => {
    expect(findDimension('nonexistent')).toBeUndefined();
  });
});

describe('isDataField', () => {
  it('returns true for data.foo', () => {
    expect(isDataField('data.foo')).toBe(true);
  });

  it('returns true for data.my_field_123', () => {
    expect(isDataField('data.my_field_123')).toBe(true);
  });

  it('returns false for status', () => {
    expect(isDataField('status')).toBe(false);
  });

  it('returns false for data. with no key', () => {
    expect(isDataField('data.')).toBe(false);
  });

  it('returns false for data.foo.bar (nested)', () => {
    expect(isDataField('data.foo.bar')).toBe(false);
  });
});
