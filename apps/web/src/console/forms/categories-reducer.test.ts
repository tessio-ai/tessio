// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { addCategory, removeCategory, setCategoryProps, moveCategory } from './categories-reducer';
import type { PortalCategory } from '@tessio/shared';

const base: PortalCategory[] = [
  { key: 'it', label: 'IT', icon: 'laptop', color: '#2563eb', order: 0, visible: true },
  { key: 'hr', label: 'HR', icon: 'user', color: '#10b981', order: 1, visible: true },
];

describe('categories-reducer', () => {
  it('addCategory appends a normalized row', () => {
    const c = addCategory(base);
    expect(c).toHaveLength(3);
    expect(c[2].order).toBe(2);
    expect(c[2].key).toMatch(/^cat_/);
  });

  it('removeCategory drops a row and renormalizes order', () => {
    const c = removeCategory(base, 0);
    expect(c.map((x) => x.key)).toEqual(['hr']);
    expect(c[0].order).toBe(0);
  });

  it('setCategoryProps patches one row by index', () => {
    const c = setCategoryProps(base, 1, { label: 'People', visible: false });
    expect(c[1]).toMatchObject({ key: 'hr', label: 'People', visible: false });
    expect(c[0].label).toBe('IT');
  });

  it('moveCategory reorders and renormalizes', () => {
    const c = moveCategory(base, 1, 0);
    expect(c.map((x) => x.key)).toEqual(['hr', 'it']);
    expect(c.map((x) => x.order)).toEqual([0, 1]);
  });
});
