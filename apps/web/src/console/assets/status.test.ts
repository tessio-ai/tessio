// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { assetStatusMeta } from './status';

describe('assetStatusMeta', () => {
  it('maps known statuses to pill tones + labels', () => {
    expect(assetStatusMeta('in_use')).toEqual({ tone: 'success', label: 'In use' });
    expect(assetStatusMeta('in_stock')).toEqual({ tone: 'info', label: 'In stock' });
    expect(assetStatusMeta('retired')).toEqual({ tone: 'neutral', label: 'Retired' });
  });
  it('falls back to neutral for unknown/null', () => {
    expect(assetStatusMeta(null)).toEqual({ tone: 'neutral', label: '—' });
    expect(assetStatusMeta('weird')).toEqual({ tone: 'neutral', label: 'weird' });
  });
});
