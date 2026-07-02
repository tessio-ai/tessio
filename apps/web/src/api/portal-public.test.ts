// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, vi, afterEach } from 'vitest';
import { listPublicForms, getPublicForm, submitForm, getPublicPortalSettings } from './portal';

afterEach(() => vi.restoreAllMocks());
function mockJson(body: unknown, status = 200) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));
}

describe('public portal api', () => {
  it('getPublicPortalSettings GETs /portal/settings', async () => {
    const f = mockJson({ orgId: 'o', heroHeadline: 'Hi', categories: [] });
    await getPublicPortalSettings();
    expect(String(f.mock.calls[0][0])).toContain('/portal/settings');
  });
  it('listPublicForms GETs /portal/forms', async () => {
    const f = mockJson([{ key: 'report', name: 'Report' }]);
    const rows = await listPublicForms();
    expect(rows[0].key).toBe('report');
    expect(String(f.mock.calls[0][0])).toContain('/portal/forms');
  });
  it('getPublicForm GETs /portal/forms/:key', async () => {
    const f = mockJson({ key: 'report', sections: [] });
    await getPublicForm('report');
    expect(String(f.mock.calls[0][0])).toContain('/portal/forms/report');
  });
  it('submitForm POSTs values to /portal/forms/:key/submit', async () => {
    const f = mockJson({ id: 't1', number: 5 }, 201);
    const res = await submitForm('report', { title: 'x' });
    expect(res.number).toBe(5);
    expect(f.mock.calls[0][1]?.method).toBe('POST');
    expect(JSON.parse(f.mock.calls[0][1]!.body as string)).toEqual({ values: { title: 'x' } });
  });
});
