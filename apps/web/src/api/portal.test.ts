// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, vi, afterEach } from 'vitest';
import { getPortalSettings, updatePortalSettings } from './portal';

afterEach(() => vi.restoreAllMocks());

function mockJson(body: unknown, status = 200) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }),
  );
}

describe('portal settings api', () => {
  it('getPortalSettings GETs /portal-settings', async () => {
    const f = mockJson({ orgId: 'o', heroHeadline: 'How can we help?' });
    const s = await getPortalSettings();
    expect(s.heroHeadline).toBe('How can we help?');
    expect(String(f.mock.calls[0][0])).toContain('/portal-settings');
    expect(f.mock.calls[0][1]?.method ?? 'GET').toBe('GET');
  });

  it('updatePortalSettings PATCHes the body', async () => {
    const f = mockJson({ orgId: 'o', brandName: 'Acme' });
    await updatePortalSettings({ brandName: 'Acme' });
    expect(f.mock.calls[0][1]?.method).toBe('PATCH');
    expect(JSON.parse(f.mock.calls[0][1]!.body as string)).toEqual({ brandName: 'Acme' });
  });
});
