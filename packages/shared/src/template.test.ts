// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { resolveTemplate } from './template';

describe('resolveTemplate', () => {
  it('substitutes tokens from values', () => {
    expect(resolveTemplate('ACME-{asset_tag}', { asset_tag: 'LAP-1' })).toBe('ACME-LAP-1');
    expect(resolveTemplate('{manufacturer} {model}', { manufacturer: 'Dell', model: 'XPS' })).toBe('Dell XPS');
  });
  it('zero-pads numeric tokens with :0000', () => {
    expect(resolveTemplate('ACME-{seq:0000}', { seq: 7 })).toBe('ACME-0007');
    expect(resolveTemplate('{seq:000}', { seq: 1234 })).toBe('1234');
  });
  it('treats any digit run as a pad width (not only zeros)', () => {
    // A non-zero pad digit (e.g. {seq:0001}) is a reasonable user input: pad width = its length.
    expect(resolveTemplate('ACME-{seq:0001}', { seq: 1 })).toBe('ACME-0001');
    expect(resolveTemplate('ACME-{seq:0001}', { seq: 42 })).toBe('ACME-0042');
    expect(resolveTemplate('{seq:99}', { seq: 3 })).toBe('03');
  });
  it('unknown/empty tokens become empty and the result is trimmed', () => {
    expect(resolveTemplate('{a}-{b}', { a: 'x' })).toBe('x-');
    expect(resolveTemplate('  {missing}  ', {})).toBe('');
  });
});
