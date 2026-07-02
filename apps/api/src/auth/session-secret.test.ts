// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { resolveSessionSecret } from './session-secret';

describe('resolveSessionSecret', () => {
  it('returns the dev fallback outside production', () => {
    expect(resolveSessionSecret('development', undefined)).toBe('dev-insecure-secret-change-me');
  });
  it('returns the provided secret', () => {
    expect(resolveSessionSecret('production', 'a-real-secret')).toBe('a-real-secret');
  });
  it('throws in production when the secret is missing', () => {
    expect(() => resolveSessionSecret('production', undefined)).toThrow(/SESSION_SECRET/);
  });
  it('throws in production when the secret is the dev default', () => {
    expect(() => resolveSessionSecret('production', 'dev-insecure-secret-change-me')).toThrow(/SESSION_SECRET/);
  });
});
