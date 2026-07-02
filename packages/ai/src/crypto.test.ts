// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { encryptSecret, decryptSecret } from './crypto';

// 32 bytes, base64 — fixed test key.
const KEY = Buffer.alloc(32, 7).toString('base64');

describe('crypto', () => {
  it('round-trips a secret', () => {
    const ct = encryptSecret('sk-test-abc123', KEY);
    expect(ct).not.toContain('sk-test-abc123');
    expect(decryptSecret(ct, KEY)).toBe('sk-test-abc123');
  });

  it('produces a different ciphertext each call (random IV)', () => {
    expect(encryptSecret('same', KEY)).not.toBe(encryptSecret('same', KEY));
  });

  it('throws when the ciphertext was tampered with', () => {
    const ct = encryptSecret('secret', KEY);
    const parts = ct.split(':');
    parts[2] = parts[2].replace(/.$/, (c) => (c === 'a' ? 'b' : 'a'));
    expect(() => decryptSecret(parts.join(':'), KEY)).toThrow();
  });

  it('throws on a key that is not 32 bytes', () => {
    expect(() => encryptSecret('x', Buffer.alloc(16).toString('base64'))).toThrow(/32 bytes/);
  });
});
