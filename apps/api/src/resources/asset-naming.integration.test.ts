// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { buildTestApp, resetDb, seedOrgAndSchema, createTestDb, loginAs } from '../testing/harness';
import { schemasRepo } from '@tessio/db';

const db = createTestDb();
const { app, teardown } = buildTestApp();

describe('asset tag + name auto-assignment', () => {
  let orgId: string;
  let schemaId: string;
  let schemaVersion: number;
  let cookie: string;

  beforeEach(async () => {
    await resetDb(db);
    ({ orgId, schemaId, schemaVersion } = await seedOrgAndSchema(db, 'asset'));
    ({ cookie } = await loginAs(app, db, { orgId, role: 'admin' }));

    // Wire templates on the schema
    await schemasRepo(db).updateDefinition(orgId, schemaId, {
      fields: [{ key: 'name', label: 'Name', type: 'text', required: false, order: 0, width: 'full' }],
      tagTemplate: 'ACME-{seq:0000}',
      nameTemplate: 'NM-{asset_tag}',
    });
    // updateDefinition bumps the version — fetch the new version
    const updated = await schemasRepo(db).getById(orgId, schemaId);
    schemaVersion = updated!.version;
  });

  afterAll(async () => {
    await db.$client.end();
    await teardown();
  });

  async function postAsset(body: Record<string, unknown>) {
    await app.ready();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/assets',
      headers: { cookie },
      payload: { ...body, schemaId, schemaVersion },
    });
    return res.json() as Record<string, unknown>;
  }

  it('auto-assigns a sequential tag and derives the name when omitted', async () => {
    const a = await postAsset({ data: {} });
    expect(a.assetTag).toBe('ACME-0001');
    expect((a.data as Record<string, unknown>).name).toBe('NM-ACME-0001');
    const b = await postAsset({ data: {} });
    expect(b.assetTag).toBe('ACME-0002');
    expect((b.data as Record<string, unknown>).name).toBe('NM-ACME-0002');
  });

  it('keeps a caller-supplied tag and name (no override)', async () => {
    const a = await postAsset({ assetTag: 'MANUAL-1', data: { name: 'Mine' } });
    expect(a.assetTag).toBe('MANUAL-1');
    expect((a.data as Record<string, unknown>).name).toBe('Mine');
  });
});
