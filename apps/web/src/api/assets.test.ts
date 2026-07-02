// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, vi, afterEach } from 'vitest';
import { queryAssets, createAsset } from './assets';

afterEach(() => {
  vi.restoreAllMocks();
});

function mockFetch(json: unknown, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(json), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('assets client', () => {
  it('POSTs the query body to /assets/query', async () => {
    const f = mockFetch({ rows: [], nextCursor: null });
    await queryAssets({ limit: 25, filter: { field: 'status', op: 'eq', value: 'in_use' } });
    const [url, init] = f.mock.calls[0];
    expect(String(url)).toContain('/assets/query');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init!.body as string)).toEqual({ limit: 25, filter: { field: 'status', op: 'eq', value: 'in_use' } });
  });
  it('POSTs create to /assets', async () => {
    const f = mockFetch({ id: 'a1' }, 201);
    await createAsset({ schemaId: 's1', schemaVersion: 1, assetTag: 'LAP-1', data: { name: 'X' } });
    const [url, init] = f.mock.calls[0];
    expect(String(url)).toContain('/assets');
    expect(init?.method).toBe('POST');
  });
});
