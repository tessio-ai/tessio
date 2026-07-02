// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { createTestDb, resetDb } from '../testing/test-db';
import { orgs } from '../schema';
import { portalSettingsRepo } from './portal-settings';

const db = createTestDb();
async function makeOrg() {
  const [org] = await db.insert(orgs).values({ name: 'Org', slug: `o-${crypto.randomUUID()}` }).returning();
  return org.id;
}

describe('portalSettingsRepo', () => {
  beforeEach(async () => { await resetDb(db); });
  afterAll(async () => { await db.$client.end(); });

  it('getOrCreate creates a default row then returns the same row', async () => {
    const orgId = await makeOrg();
    const first = await portalSettingsRepo(db).getOrCreate(orgId);
    expect(first.heroHeadline).toBe('How can we help?');
    const second = await portalSettingsRepo(db).getOrCreate(orgId);
    expect(second.orgId).toBe(first.orgId);
  });

  it('update patches fields', async () => {
    const orgId = await makeOrg();
    await portalSettingsRepo(db).getOrCreate(orgId);
    const updated = await portalSettingsRepo(db).update(orgId, { brandName: 'Acme', heroHeadline: 'Hi' });
    expect(updated?.brandName).toBe('Acme');
    expect(updated?.heroHeadline).toBe('Hi');
  });
});
