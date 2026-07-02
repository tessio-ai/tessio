// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { createTestDb, resetDb } from './test-db';
import { orgs } from '../schema';

const db = createTestDb();

describe('integration harness', () => {
  beforeEach(async () => {
    await resetDb(db);
  });
  afterAll(async () => {
    await db.$client.end();
  });

  it('inserts and reads back an org against real Postgres', async () => {
    const [inserted] = await db.insert(orgs).values({ name: 'Acme', slug: 'acme' }).returning();
    expect(inserted.id).toBeTruthy();

    const rows = await db.select().from(orgs);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Acme');
  });
});
