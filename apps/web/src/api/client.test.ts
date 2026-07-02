// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, vi, afterEach } from 'vitest';
import { request, setUnauthorizedHandler } from './client';
import { ApiError } from './types';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('request', () => {
  it('sends credentials and no x-org-id header', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    await request('/auth/me');
    const init = fetchMock.mock.calls[0][1]!;
    expect(init.credentials).toBe('include');
    expect((init.headers as Record<string, string>)['x-org-id']).toBeUndefined();
  });

  it('returns parsed JSON on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    const body = await request<{ ok: boolean }>('/tickets');
    expect(body).toEqual({ ok: true });
  });

  it('throws ApiError on a problem+json error response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ title: 'Not Found', status: 404, detail: 'nope' }), {
        status: 404,
        headers: { 'content-type': 'application/problem+json' },
      }),
    );
    await expect(request('/tickets/x')).rejects.toBeInstanceOf(ApiError);
  });

  it('invokes the unauthorized handler on a 401', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ title: 'Unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } }),
    );
    await expect(request('/auth/me')).rejects.toBeTruthy();
    expect(handler).toHaveBeenCalled();
    setUnauthorizedHandler(null);
  });
});
