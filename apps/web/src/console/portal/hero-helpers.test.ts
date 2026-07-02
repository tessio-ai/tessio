// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { splitHeadline, resolvePills } from './hero-helpers';

describe('splitHeadline', () => {
  it('marks the *asterisk* span as emphasised', () => {
    expect(splitHeadline('How can we *help*, Dana?')).toEqual([
      { text: 'How can we ', em: false }, { text: 'help', em: true }, { text: ', Dana?', em: false },
    ]);
  });
  it('returns one plain segment when no marker', () => {
    expect(splitHeadline('Hello')).toEqual([{ text: 'Hello', em: false }]);
  });
});

describe('resolvePills', () => {
  const forms = [
    { key: 'a', name: 'Reset password', description: null, categoryKey: 'IT', icon: null, theme: { showTess: true } },
    { key: 'b', name: 'New laptop', description: null, categoryKey: 'IT', icon: null, theme: { showTess: false } },
  ] as never;
  it('uses explicit pills when provided', () => {
    expect(resolvePills([{ label: 'X', formKey: 'b' }], forms)).toEqual([{ label: 'X', formKey: 'b' }]);
  });
  it('auto-populates up to 4 from Tess-assisted forms first', () => {
    const r = resolvePills([], forms);
    expect(r[0]).toEqual({ label: 'Reset password', formKey: 'a' });
    expect(r.length).toBeLessThanOrEqual(4);
  });
});
