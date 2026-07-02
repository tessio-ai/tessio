// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { createTestDb, resetDb, seedOrgAndSchema } from '../testing/test-db';
import { viewsRepo } from './views';

const db = createTestDb();

describe('viewsRepo', () => {
  beforeEach(async () => {
    await resetDb(db);
  });
  afterAll(async () => {
    await db.$client.end();
  });

  it('creates a view storing opaque filter/sort/columns and reads it back', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    const repo = viewsRepo(db);
    const created = await repo.create(orgId, {
      targetKind: 'ticket',
      name: 'My open tickets',
      filter: { op: 'eq', field: 'status', value: 'open' },
      sort: [{ field: 'created_at', dir: 'desc' }],
      columns: ['number', 'status', 'assignee_id'],
      shared: false,
    });
    const fetched = await repo.getById(orgId, created.id);
    expect(fetched?.name).toBe('My open tickets');
    expect(fetched?.filter).toEqual({ op: 'eq', field: 'status', value: 'open' });
    expect(fetched?.columns).toEqual(['number', 'status', 'assignee_id']);
  });

  it('lists views for an org', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    const repo = viewsRepo(db);
    await repo.create(orgId, { targetKind: 'ticket', name: 'A' });
    await repo.create(orgId, { targetKind: 'asset', name: 'B' });
    expect(await repo.list(orgId)).toHaveLength(2);
  });
});
