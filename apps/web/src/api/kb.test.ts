// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, vi, afterEach } from 'vitest';
import { queryArticles, updateArticle } from './kb';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('kb client', () => {
  it('queryArticles POSTs to /kb-articles/query', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ rows: [], nextCursor: null }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    await queryArticles({ sort: { field: 'updatedAt', dir: 'desc' } });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/kb-articles/query');
    expect(init.method).toBe('POST');
  });

  it('updateArticle PATCHes /kb-articles/:id', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    await updateArticle('a1', { status: 'published' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/kb-articles/a1');
    expect(init.method).toBe('PATCH');
  });
});
