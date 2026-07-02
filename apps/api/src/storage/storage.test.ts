// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { diskStorage } from './storage';

const dir = mkdtempSync(join(tmpdir(), 'tessio-storage-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('diskStorage', () => {
  it('round-trips put → get and removes on delete', async () => {
    const s = diskStorage(dir);
    await s.put('org1/att1', Buffer.from('hello world'));
    expect((await s.get('org1/att1')).toString()).toBe('hello world');
    await s.delete('org1/att1');
    await expect(s.get('org1/att1')).rejects.toThrow();
  });
  it('isolates keys under different org prefixes', async () => {
    const s = diskStorage(dir);
    await s.put('orgA/x', Buffer.from('A'));
    await s.put('orgB/x', Buffer.from('B'));
    expect((await s.get('orgA/x')).toString()).toBe('A');
    expect((await s.get('orgB/x')).toString()).toBe('B');
  });
});
