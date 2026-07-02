// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { createTestDb, resetDb, seedOrgAndSchema } from '../testing/test-db';
import { assetsRepo } from './assets';
import { kbArticlesRepo } from './kb-articles';
import { formSubmissionsRepo } from './form-submissions';

const db = createTestDb();

describe('domain table repositories', () => {
  beforeEach(async () => {
    await resetDb(db);
  });
  afterAll(async () => {
    await db.$client.end();
  });

  it('assets: create/get with asset-specific columns and status enum', async () => {
    const { orgId, schemaId, schemaVersion } = await seedOrgAndSchema(db, 'asset');
    const repo = assetsRepo(db);
    const created = await repo.create({ orgId, schemaId, schemaVersion, assetTag: 'LAP-001', status: 'in_stock' });
    const fetched = await repo.getById(orgId, created.id);
    expect(fetched?.assetTag).toBe('LAP-001');
    expect(fetched?.status).toBe('in_stock');
  });

  it('kb_articles: create/get with title, slug, and draft status', async () => {
    const { orgId, schemaId, schemaVersion } = await seedOrgAndSchema(db, 'kb_article');
    const repo = kbArticlesRepo(db);
    const created = await repo.create({ orgId, schemaId, schemaVersion, title: 'How to reset', slug: 'how-to-reset', status: 'draft' });
    const fetched = await repo.getById(orgId, created.id);
    expect(fetched?.slug).toBe('how-to-reset');
    expect(fetched?.status).toBe('draft');
  });

  it('form_submissions: create/get with source enum', async () => {
    const { orgId, schemaId, schemaVersion } = await seedOrgAndSchema(db, 'form');
    const repo = formSubmissionsRepo(db);
    const created = await repo.create({ orgId, schemaId, schemaVersion, formSchemaId: schemaId, source: 'portal' });
    const fetched = await repo.getById(orgId, created.id);
    expect(fetched?.source).toBe('portal');
  });
});
