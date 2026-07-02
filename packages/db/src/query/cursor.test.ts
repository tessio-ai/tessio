// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { encodeCursor, decodeCursor } from './cursor';

describe('cursor codec', () => {
  it('round-trips a sort value + id', () => {
    const token = encodeCursor({ value: 'open', id: '11111111-1111-1111-1111-111111111111' });
    expect(decodeCursor(token)).toEqual({ value: 'open', id: '11111111-1111-1111-1111-111111111111' });
  });

  it('round-trips a null sort value (id-only pagination)', () => {
    const token = encodeCursor({ value: null, id: 'abc' });
    expect(decodeCursor(token)).toEqual({ value: null, id: 'abc' });
  });

  it('produces a url-safe opaque string (no +,/,=)', () => {
    const token = encodeCursor({ value: 'a/b+c', id: 'x' });
    expect(token).not.toMatch(/[+/=]/);
  });

  it('throws on a malformed cursor', () => {
    expect(() => decodeCursor('!!!not-base64!!!')).toThrow();
  });
});
