// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('password hashing', () => {
  it('verifies a correct password round-trip', async () => {
    const hash = await hashPassword('hunter2');
    expect(hash.startsWith('scrypt$')).toBe(true);
    expect(await verifyPassword('hunter2', hash)).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('hunter2');
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });

  it('uses a random salt (two hashes of the same password differ)', async () => {
    expect(await hashPassword('same')).not.toBe(await hashPassword('same'));
  });

  it('returns false for a malformed encoded hash', async () => {
    expect(await verifyPassword('x', 'not-a-hash')).toBe(false);
  });
});
