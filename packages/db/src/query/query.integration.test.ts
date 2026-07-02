// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { createTestDb, resetDb, seedOrgAndSchema } from '../testing/test-db';
import { tickets } from '../schema';
import { createRecordRepository } from '../repositories/records';

const db = createTestDb();
const repo = createRecordRepository(db, tickets);

describe('repo.query (filter + sort + keyset pagination)', () => {
  beforeEach(async () => {
    await resetDb(db);
  });
  afterAll(async () => {
    await db.$client.end();
  });

  it('applies a compiled filter and returns a null cursor when exhausted', async () => {
    const { orgId, schemaId, schemaVersion } = await seedOrgAndSchema(db, 'ticket');
    await repo.create({ orgId, schemaId, schemaVersion, status: 'open' });
    await repo.create({ orgId, schemaId, schemaVersion, status: 'closed' });
    const page = await repo.query(orgId, { filter: { field: 'status', op: 'eq', value: 'open' } });
    expect(page.rows).toHaveLength(1);
    expect(page.nextCursor).toBeNull();
  });

  it('sorts by a system column ascending', async () => {
    const { orgId, schemaId, schemaVersion } = await seedOrgAndSchema(db, 'ticket');
    await repo.create({ orgId, schemaId, schemaVersion, priority: 'b' });
    await repo.create({ orgId, schemaId, schemaVersion, priority: 'a' });
    await repo.create({ orgId, schemaId, schemaVersion, priority: 'c' });
    const page = await repo.query(orgId, { sort: { field: 'priority', dir: 'asc' } });
    expect(page.rows.map((r) => r.priority)).toEqual(['a', 'b', 'c']);
  });

  it('paginates with a stable opaque cursor across pages', async () => {
    const { orgId, schemaId, schemaVersion } = await seedOrgAndSchema(db, 'ticket');
    for (let i = 0; i < 5; i++) {
      await repo.create({ orgId, schemaId, schemaVersion, priority: `p${i}` });
    }
    const sort = { field: 'priority' as const, dir: 'asc' as const };
    const page1 = await repo.query(orgId, { sort, limit: 2 });
    expect(page1.rows.map((r) => r.priority)).toEqual(['p0', 'p1']);
    expect(page1.nextCursor).not.toBeNull();

    const page2 = await repo.query(orgId, { sort, limit: 2, cursor: page1.nextCursor! });
    expect(page2.rows.map((r) => r.priority)).toEqual(['p2', 'p3']);

    const page3 = await repo.query(orgId, { sort, limit: 2, cursor: page2.nextCursor! });
    expect(page3.rows.map((r) => r.priority)).toEqual(['p4']);
    expect(page3.nextCursor).toBeNull();
  });

  it('paginates by id when no sort is given', async () => {
    const { orgId, schemaId, schemaVersion } = await seedOrgAndSchema(db, 'ticket');
    for (let i = 0; i < 3; i++) await repo.create({ orgId, schemaId, schemaVersion });
    const all: string[] = [];
    let cursor: string | null = null;
    do {
      const page = await repo.query(orgId, { limit: 2, cursor: cursor ?? undefined });
      all.push(...page.rows.map((r) => r.id));
      cursor = page.nextCursor;
    } while (cursor);
    expect(new Set(all).size).toBe(3);
  });

  it('caps limit at the maximum', async () => {
    const { orgId, schemaId, schemaVersion } = await seedOrgAndSchema(db, 'ticket');
    for (let i = 0; i < 3; i++) await repo.create({ orgId, schemaId, schemaVersion });
    const page = await repo.query(orgId, { limit: 10000 });
    expect(page.rows).toHaveLength(3);
  });

  it('excludes soft-deleted rows', async () => {
    const { orgId, schemaId, schemaVersion } = await seedOrgAndSchema(db, 'ticket');
    const t = await repo.create({ orgId, schemaId, schemaVersion });
    await repo.softDelete(orgId, t.id);
    const page = await repo.query(orgId, {});
    expect(page.rows).toHaveLength(0);
  });
});
