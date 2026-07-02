// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { emailDomain, ssoSettingsInput } from './sso';

describe('sso', () => {
  it('emailDomain lower-cases the domain', () => {
    expect(emailDomain('a@B.com')).toBe('b.com');
  });
  it('emailDomain returns null for non-emails', () => {
    expect(emailDomain('bad')).toBeNull();
  });
  it('ssoSettingsInput rejects a non-URL issuer', () => {
    expect(ssoSettingsInput.safeParse({ issuer: 'noturl' }).success).toBe(false);
  });
  it('ssoSettingsInput accepts a valid partial', () => {
    expect(
      ssoSettingsInput.safeParse({
        enabled: true,
        issuer: 'https://accounts.google.com',
        clientId: 'x',
      }).success,
    ).toBe(true);
  });
});
