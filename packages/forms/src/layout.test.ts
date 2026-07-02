// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { widthToColSpan } from './layout';

describe('widthToColSpan', () => {
  it('maps widths to grid spans on a 6-col grid', () => {
    expect(widthToColSpan('full')).toBe('col-span-6');
    expect(widthToColSpan('half')).toBe('col-span-3');
    expect(widthToColSpan('third')).toBe('col-span-2');
  });
});
