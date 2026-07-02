// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, afterAll } from 'vitest';
import { buildTestApp } from './testing/harness';

const { app, teardown } = buildTestApp();

describe('OpenAPI document', () => {
  afterAll(async () => {
    await teardown();
  });

  it('serves an OpenAPI 3 document describing the API', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/openapi.json' });
    expect(res.statusCode).toBe(200);
    const doc = res.json();
    expect(doc.openapi).toMatch(/^3\./);
    expect(doc.info.title).toBe('Tessio API');
    expect(doc.paths).toBeTruthy();
  });
});
