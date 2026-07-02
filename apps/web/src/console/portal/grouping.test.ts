// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { groupForms } from './grouping';
import type { PublicFormSummary } from '../../api/portal';
import type { PortalCategory } from '@tessio/shared';

const cat = (key: string, order = 0): PortalCategory => ({ key, label: key, icon: 'inbox', color: '#000', order, visible: true });
const form = (key: string, categoryKey: string): PublicFormSummary => ({ key, name: key, description: null, categoryKey, icon: null, theme: { showTess: false } as never });

describe('groupForms', () => {
  it('groups forms under visible categories by order and skips empty categories', () => {
    const { groups, orphans } = groupForms([form('a', 'IT'), form('b', 'HR')], [cat('HR', 1), cat('IT', 0), cat('EMPTY', 2)]);
    expect(groups.map((g) => g.category.key)).toEqual(['IT', 'HR']);
    expect(orphans).toEqual([]);
  });
  it('collects forms with no matching visible category as orphans', () => {
    const { groups, orphans } = groupForms([form('a', 'NOPE')], [cat('IT', 0)]);
    expect(groups).toEqual([]);
    expect(orphans.map((f) => f.key)).toEqual(['a']);
  });
});
