// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { createTestDb, resetDb, seedOrgAndSchema } from '../testing/test-db';
import { kbRevisionsRepo, kbArticlesRepo } from './index';

const db = createTestDb();
const revs = kbRevisionsRepo(db);

describe('kbRevisionsRepo', () => {
  beforeEach(async () => { await resetDb(db); });
  afterAll(async () => { await db.$client.end(); });

  it('snapshots sequential versions and bumps contentVersion', async () => {
    const { orgId, schemaId, schemaVersion } = await seedOrgAndSchema(db, 'kb_article');
    const article = await kbArticlesRepo(db).create({ orgId, schemaId, schemaVersion, title: 'A', data: { body: 'v1' } });
    const r1 = await revs.snapshot(orgId, { id: article.id, title: 'A', data: { body: 'v1' } }, null);
    const r2 = await revs.snapshot(orgId, { id: article.id, title: 'A', data: { body: 'v2' } }, null);
    expect([r1.version, r2.version]).toEqual([1, 2]);
    const list = await revs.list(orgId, article.id);
    expect(list.map((x) => x.version)).toEqual([2, 1]);
    expect((await kbArticlesRepo(db).getById(orgId, article.id))?.contentVersion).toBe(2);
    const full = await revs.get(orgId, article.id, r1.id);
    expect(full?.data).toMatchObject({ body: 'v1' });
  });
});
