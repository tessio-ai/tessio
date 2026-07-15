// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Defense-in-depth headers must ride every API response — Caddy sets the full
 * set at the front door, but the API holds its own even when reached directly.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildTestApp, createTestDb } from './testing/harness';

process.env.TESSIO_SECRET_KEY = Buffer.alloc(32, 1).toString('base64');

const db = createTestDb();
const { app, teardown } = buildTestApp();

describe('security headers', () => {
  beforeAll(async () => {
    await app.ready();
  });
  afterAll(async () => {
    await db.$client.end();
    await teardown();
  });

  it('sets nosniff / frame-deny / referrer-policy / CSP on success and error responses alike', async () => {
    for (const url of ['/health', '/api/v1/definitely-not-a-route']) {
      const res = await app.inject({ method: 'GET', url });
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('DENY');
      expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(res.headers['content-security-policy']).toContain("default-src 'none'");
    }
  });
});
