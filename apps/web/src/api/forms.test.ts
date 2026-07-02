// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, vi, afterEach } from 'vitest';
import { listForms, createForm, updateForm, archiveForm } from './forms';
import { createSchema, updateSchema } from './schemas';

afterEach(() => vi.restoreAllMocks());

function mockJson(body: unknown, status = 200) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }),
  );
}

describe('forms api', () => {
  it('listForms GETs /forms', async () => {
    const f = mockJson([{ id: 'f1' }]);
    const rows = await listForms();
    expect(rows[0].id).toBe('f1');
    expect(String(f.mock.calls[0][0])).toContain('/forms');
  });

  it('createForm POSTs the body', async () => {
    const f = mockJson({ id: 'f2' }, 201);
    await createForm({ key: 'k', name: 'N', categoryKey: 'IT', targetSchemaId: 's1', theme: { accent: '#000', headline: 'H' } });
    expect(f.mock.calls[0][1]?.method).toBe('POST');
  });

  it('updateForm PATCHes /forms/:id', async () => {
    const f = mockJson({ id: 'f3' });
    await updateForm('f3', { name: 'X' });
    expect(f.mock.calls[0][1]?.method).toBe('PATCH');
    expect(String(f.mock.calls[0][0])).toContain('/forms/f3');
  });

  it('archiveForm DELETEs /forms/:id', async () => {
    const f = mockJson({ id: 'f4', status: 'archived' });
    await archiveForm('f4');
    expect(f.mock.calls[0][1]?.method).toBe('DELETE');
  });

  it('createSchema POSTs /schemas and updateSchema PATCHes', async () => {
    const f = mockJson({ id: 's9' }, 201);
    await createSchema({ name: 'T' });
    expect(String(f.mock.calls[0][0])).toContain('/schemas');
    f.mockResolvedValue(new Response(JSON.stringify({ id: 's9', version: 2 }), { status: 200, headers: { 'content-type': 'application/json' } }));
    await updateSchema('s9', { definition: { fields: [] } });
    expect(f.mock.calls[1][1]?.method).toBe('PATCH');
  });
});
