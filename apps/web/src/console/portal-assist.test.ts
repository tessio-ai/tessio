// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { detectCategory, DEFLECT, ROUTE } from './portal-assist';

describe('portal-assist', () => {
  it('detects categories from text', () => {
    expect(detectCategory('my laptop screen is broken')).toBe('Hardware');
    expect(detectCategory('cannot connect to vpn')).toBe('Network');
    expect(detectCategory('reset my password')).toBe('Access');
    expect(detectCategory('hello world')).toBeNull();
  });
  it('exposes deflection + routing content', () => {
    expect(DEFLECT.Hardware.title).toBeTruthy();
    expect(ROUTE.Other.team).toBeTruthy();
  });
});
