// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { createTestDb, resetDb } from '../testing/test-db';
import { orgs } from '../schema';
import { aiSettingsRepo } from './ai-settings';

const db = createTestDb();
async function makeOrg() {
  const [org] = await db.insert(orgs).values({ name: 'Org', slug: `o-${crypto.randomUUID()}` }).returning();
  return org.id;
}

describe('aiSettingsRepo', () => {
  beforeEach(async () => { await resetDb(db); });
  afterAll(async () => { await db.$client.end(); });

  it('getOrCreate returns a default disabled row with all features false', async () => {
    const orgId = await makeOrg();
    const row = await aiSettingsRepo(db).getOrCreate(orgId);
    expect(row).toBeDefined();
    expect(row!.orgId).toBe(orgId);
    expect(row!.enabled).toBe(false);
    expect(row!.features.summary).toBe(false);
    expect(row!.features.draft).toBe(false);
    expect(row!.features.triage).toBe(false);
    expect(row!.features.similar).toBe(false);
    expect(row!.features.ask).toBe(false);
  });

  it('getOrCreate is idempotent — calling twice returns the same row and only one row exists', async () => {
    const orgId = await makeOrg();
    const first = await aiSettingsRepo(db).getOrCreate(orgId);
    const second = await aiSettingsRepo(db).getOrCreate(orgId);
    expect(second!.orgId).toBe(first!.orgId);

    // Verify only one row in the DB for this org
    const { aiSettings } = await import('../schema');
    const { eq } = await import('drizzle-orm');
    const rows = await db.select().from(aiSettings).where(eq(aiSettings.orgId, orgId));
    expect(rows).toHaveLength(1);
  });

  it('update persists a patch and bumps updatedAt', async () => {
    const orgId = await makeOrg();
    const created = await aiSettingsRepo(db).getOrCreate(orgId);
    const before = created!.updatedAt;

    // Small delay to ensure updatedAt changes
    await new Promise((r) => setTimeout(r, 5));

    const updated = await aiSettingsRepo(db).update(orgId, {
      enabled: true,
      model: 'gpt-4o-mini',
      embeddingModel: 'text-embedding-3-small',
      apiKeyHint: 'abcd',
      features: { summary: true, draft: false, triage: true, similar: false, ask: false },
    });

    expect(updated).toBeDefined();
    expect(updated!.enabled).toBe(true);
    expect(updated!.model).toBe('gpt-4o-mini');
    expect(updated!.embeddingModel).toBe('text-embedding-3-small');
    expect(updated!.apiKeyHint).toBe('abcd');
    expect(updated!.features.summary).toBe(true);
    expect(updated!.features.draft).toBe(false);
    expect(updated!.features.triage).toBe(true);
    expect(updated!.updatedAt.getTime()).toBeGreaterThan(before.getTime());
  });
});
