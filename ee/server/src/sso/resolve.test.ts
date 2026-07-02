// SPDX-License-Identifier: LicenseRef-Tessio-Commercial

import { describe, it, expect } from 'vitest';
import { resolveSsoUser } from './resolve';

const base = {
  email: 'u@acme.com',
  emailVerified: true as boolean | undefined,
  allowedDomain: null as string | null,
  autoCreate: false,
  existingUser: null as { id: string; status: string } | null,
};

describe('resolveSsoUser', () => {
  it('logs in an active existing user', () => {
    expect(resolveSsoUser({ ...base, existingUser: { id: 'u1', status: 'active' } })).toEqual({ action: 'login', userId: 'u1' });
  });

  it('rejects a disabled existing user', () => {
    expect(resolveSsoUser({ ...base, existingUser: { id: 'u1', status: 'disabled' } })).toEqual({ action: 'reject', reason: 'disabled_user' });
  });

  it('rejects an unverified email', () => {
    expect(resolveSsoUser({ ...base, emailVerified: false, existingUser: { id: 'u1', status: 'active' } })).toEqual({ action: 'reject', reason: 'unverified' });
  });

  it('rejects when email_verified is absent (undefined), not just when false', () => {
    expect(resolveSsoUser({ ...base, emailVerified: undefined, existingUser: { id: 'u1', status: 'active' } })).toEqual({ action: 'reject', reason: 'unverified' });
  });

  it('rejects a domain mismatch and passes a match', () => {
    expect(resolveSsoUser({ ...base, allowedDomain: 'other.com', existingUser: { id: 'u1', status: 'active' } })).toEqual({ action: 'reject', reason: 'domain' });
    expect(resolveSsoUser({ ...base, allowedDomain: 'ACME.com', existingUser: { id: 'u1', status: 'active' } })).toEqual({ action: 'login', userId: 'u1' });
  });

  it('creates when no user + autoCreate on', () => {
    expect(resolveSsoUser({ ...base, autoCreate: true })).toEqual({ action: 'create' });
  });

  it('rejects no_account when no user + autoCreate off', () => {
    expect(resolveSsoUser({ ...base })).toEqual({ action: 'reject', reason: 'no_account' });
  });
});
