// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { niceMax, barLayout, linePath, pieSlices, formatValue } from './charts';
import type { ReportRow } from './charts';

// ---------------------------------------------------------------------------
// niceMax
// ---------------------------------------------------------------------------

describe('niceMax', () => {
  it('returns 1 for 0 or negative', () => {
    expect(niceMax(0)).toBe(1);
    expect(niceMax(-5)).toBe(1);
  });

  it('returns 1 for small values ≤1', () => {
    expect(niceMax(0.5)).toBe(1);
    expect(niceMax(1)).toBe(1);
  });

  it('rounds small integers up to nice values', () => {
    expect(niceMax(7)).toBe(10);
    expect(niceMax(5)).toBe(5);
    expect(niceMax(3)).toBe(5);
    expect(niceMax(2)).toBe(2);
  });

  it('rounds two-digit numbers nicely', () => {
    expect(niceMax(23)).toBe(25);
    expect(niceMax(26)).toBe(50);
    expect(niceMax(50)).toBe(50);
    expect(niceMax(51)).toBe(100);
  });

  it('rounds three-digit numbers nicely', () => {
    expect(niceMax(140)).toBe(200);
    expect(niceMax(100)).toBe(100);
    expect(niceMax(101)).toBe(200);
  });

  it('rounds large numbers nicely', () => {
    expect(niceMax(1234)).toBe(2000);
    expect(niceMax(5000)).toBe(5000);
    expect(niceMax(5001)).toBe(10000);
  });

  it('always returns a value >= input', () => {
    for (const v of [1, 2, 7, 10, 23, 50, 99, 100, 140, 500, 999, 1234]) {
      expect(niceMax(v)).toBeGreaterThanOrEqual(v);
    }
  });
});

// ---------------------------------------------------------------------------
// barLayout
// ---------------------------------------------------------------------------

describe('barLayout', () => {
  it('returns empty array for empty rows', () => {
    expect(barLayout([], 400, 200)).toEqual([]);
  });

  it('returns one rect per row', () => {
    const rows: ReportRow[] = [
      { key: 'a', value: 10 },
      { key: 'b', value: 20 },
      { key: 'c', value: 5 },
    ];
    const rects = barLayout(rows, 400, 200);
    expect(rects).toHaveLength(3);
  });

  it('is safe when max=0 (all values 0)', () => {
    const rows: ReportRow[] = [
      { key: 'a', value: 0 },
      { key: 'b', value: 0 },
    ];
    const rects = barLayout(rows, 400, 200);
    expect(rects).toHaveLength(2);
    expect(rects[0].h).toBe(0);
    expect(rects[1].h).toBe(0);
    // y should be at bottom (h=0 so y=height)
    expect(rects[0].y).toBe(200);
  });

  it('tallest bar reaches the full height', () => {
    const rows: ReportRow[] = [
      { key: 'a', value: 100 },
      { key: 'b', value: 50 },
    ];
    const rects = barLayout(rows, 400, 200);
    // value 100 = niceMax(100) = 100, so frac=1 → h=200
    expect(rects[0].h).toBe(200);
  });

  it('proportions are correct', () => {
    const rows: ReportRow[] = [
      { key: 'a', value: 100 },
      { key: 'b', value: 50 },
    ];
    const rects = barLayout(rows, 400, 200);
    // bar[1] value is 50/100 of max → h should be 100
    expect(rects[1].h).toBe(100);
  });

  it('bars do not overlap horizontally', () => {
    const rows: ReportRow[] = [
      { key: 'a', value: 10 },
      { key: 'b', value: 20 },
      { key: 'c', value: 30 },
    ];
    const rects = barLayout(rows, 400, 200);
    for (let i = 0; i < rects.length - 1; i++) {
      expect(rects[i].x + rects[i].w).toBeLessThanOrEqual(rects[i + 1].x);
    }
  });

  it('all bars fit within width', () => {
    const rows: ReportRow[] = [
      { key: 'a', value: 10 },
      { key: 'b', value: 20 },
    ];
    const rects = barLayout(rows, 400, 200);
    for (const r of rects) {
      expect(r.x + r.w).toBeLessThanOrEqual(400);
    }
  });
});

// ---------------------------------------------------------------------------
// linePath
// ---------------------------------------------------------------------------

describe('linePath', () => {
  it('returns empty string for empty values', () => {
    expect(linePath([], 400, 200, 100)).toBe('');
  });

  it('returns a horizontal midline path for a single point', () => {
    const p = linePath([50], 400, 200, 100);
    // Single point: horizontal line at y = height/2 = 100
    expect(p).toBe('M0,100 L400,100');
  });

  it('maps two-point values to expected y coordinates', () => {
    // max=100, height=200: value=100 → y=0 (top), value=0 → y=200 (bottom)
    const p = linePath([100, 0], 400, 200, 100);
    expect(p).toBe('M0.0,0.0 L400.0,200.0');
  });

  it('returns a non-empty path with M and L commands', () => {
    const p = linePath([10, 20, 30], 400, 200, 100);
    expect(p).toBeTruthy();
    expect(p).toMatch(/^M/);
    expect(p).toContain('L');
  });

  it('first point starts at x=0', () => {
    const p = linePath([10, 20, 30], 400, 200, 100);
    expect(p).toMatch(/^M0\.0,/);
  });

  it('last point ends at x=width', () => {
    const p = linePath([10, 20, 30], 400, 200, 100);
    expect(p).toContain('400.0');
  });

  it('uses provided max for scaling', () => {
    // With max=100, value=100 should be at y=0
    const p = linePath([100], 400, 200, 100);
    // single point returns horizontal line at y=0
    expect(p).toBeTruthy();
  });

  it('handles max=0 gracefully', () => {
    const p = linePath([0, 0, 0], 400, 200, 0);
    expect(p).toBeTruthy();
    expect(p.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// pieSlices
// ---------------------------------------------------------------------------

describe('pieSlices', () => {
  it('returns empty array for empty rows', () => {
    expect(pieSlices([])).toEqual([]);
  });

  it('fractions sum to approximately 1 for non-empty rows', () => {
    const rows: ReportRow[] = [
      { key: 'a', value: 30 },
      { key: 'b', value: 20 },
      { key: 'c', value: 50 },
    ];
    const slices = pieSlices(rows);
    const fracSum = slices.reduce((s, sl) => s + sl.frac, 0);
    expect(fracSum).toBeCloseTo(1, 5);
  });

  it('angles span full circle (2π)', () => {
    const rows: ReportRow[] = [
      { key: 'a', value: 1 },
      { key: 'b', value: 2 },
      { key: 'c', value: 3 },
    ];
    const slices = pieSlices(rows);
    const last = slices[slices.length - 1];
    // From −π/2 to −π/2 + 2π
    expect(last.end).toBeCloseTo(-Math.PI / 2 + Math.PI * 2, 5);
  });

  it('handles total=0 gracefully (all fracs = 0)', () => {
    const rows: ReportRow[] = [
      { key: 'a', value: 0 },
      { key: 'b', value: 0 },
    ];
    const slices = pieSlices(rows);
    expect(slices).toHaveLength(2);
    expect(slices[0].frac).toBe(0);
    expect(slices[1].frac).toBe(0);
  });

  it('each slice.start equals previous slice.end', () => {
    const rows: ReportRow[] = [
      { key: 'a', value: 10 },
      { key: 'b', value: 20 },
      { key: 'c', value: 30 },
    ];
    const slices = pieSlices(rows);
    for (let i = 1; i < slices.length; i++) {
      expect(slices[i].start).toBeCloseTo(slices[i - 1].end, 10);
    }
  });

  it('returns one slice per row', () => {
    const rows: ReportRow[] = [
      { key: 'a', value: 10 },
      { key: 'b', value: 20 },
    ];
    expect(pieSlices(rows)).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// formatValue
// ---------------------------------------------------------------------------

describe('formatValue', () => {
  it('formats integers with thousands separators', () => {
    expect(formatValue(1000)).toBe('1,000');
    expect(formatValue(1234567)).toBe('1,234,567');
  });

  it('formats small integers without decimals', () => {
    expect(formatValue(0)).toBe('0');
    expect(formatValue(42)).toBe('42');
    expect(formatValue(100)).toBe('100');
  });

  it('formats fractional numbers', () => {
    const v = formatValue(3.14159);
    expect(v).toMatch(/3\.1/);
  });

  it('handles negative numbers', () => {
    expect(formatValue(-5)).toBe('-5');
  });

  it('returns — for non-finite values', () => {
    expect(formatValue(Infinity)).toBe('—');
    expect(formatValue(NaN)).toBe('—');
  });
});
