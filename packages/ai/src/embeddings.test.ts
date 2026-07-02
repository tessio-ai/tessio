// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { contentHash } from './embeddings';

describe('contentHash', () => {
  it('is stable for the same inputs', () => {
    expect(contentHash('Printer offline', 'down on 3F')).toBe(contentHash('Printer offline', 'down on 3F'));
  });
  it('changes when the text changes', () => {
    expect(contentHash('a', 'b')).not.toBe(contentHash('a', 'c'));
  });
  it('returns a 64-char hex sha256', () => {
    expect(contentHash('x', 'y')).toMatch(/^[0-9a-f]{64}$/);
  });
  it('distinguishes which field text belongs to', () => {
    expect(contentHash('ab', '')).not.toBe(contentHash('a', 'b'));
  });
});
