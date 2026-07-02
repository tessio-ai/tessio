// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadEnv } from './load-env';

describe('loadEnv', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'tessio-env-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    delete process.env.TESSIO_TEST_FRESH;
    delete process.env.TESSIO_TEST_KEPT;
  });

  it('loads a fresh var (splitting only on the first =, so base64 padding survives)', () => {
    writeFileSync(join(dir, '.env'), '# comment\nTESSIO_TEST_FRESH=ab+/cd==\n\n');
    loadEnv(dir);
    expect(process.env.TESSIO_TEST_FRESH).toBe('ab+/cd==');
  });

  it('does not override a variable already set in the real environment', () => {
    process.env.TESSIO_TEST_KEPT = 'real';
    writeFileSync(join(dir, '.env'), 'TESSIO_TEST_KEPT=fromfile\n');
    loadEnv(dir);
    expect(process.env.TESSIO_TEST_KEPT).toBe('real');
  });

  it('searches upward from the start dir to find the nearest .env', () => {
    const nested = join(dir, 'apps', 'api');
    mkdirSync(nested, { recursive: true });
    writeFileSync(join(dir, '.env'), 'TESSIO_TEST_FRESH=found-at-root\n');
    loadEnv(nested);
    expect(process.env.TESSIO_TEST_FRESH).toBe('found-at-root');
  });

  it('no-ops (no throw) and sets nothing when no .env exists up the tree', () => {
    // dir is an empty temp dir; even if some ancestor has a .env, it cannot define our unique key.
    expect(() => loadEnv(dir)).not.toThrow();
    expect(process.env.TESSIO_TEST_FRESH).toBeUndefined();
  });
});
