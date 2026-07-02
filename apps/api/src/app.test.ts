// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import type { Db } from '@tessio/db';
import { buildApp } from './app';

describe('GET /health', () => {
  it('returns ok', async () => {
    const app = buildApp({ db: {} as Db });
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
    await app.close();
  });
});
