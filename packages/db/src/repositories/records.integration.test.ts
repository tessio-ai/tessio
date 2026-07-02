// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { createTestDb, resetDb, seedOrgAndSchema } from '../testing/test-db';
import { tickets } from '../schema';
import { createRecordRepository } from './records';

const db = createTestDb();
const repo = createRecordRepository(db, tickets);

describe('createRecordRepository (against tickets)', () => {
  beforeEach(async () => {
    await resetDb(db);
  });
  afterAll(async () => {
    await db.$client.end();
  });

  it('creates and gets a record scoped to its org', async () => {
    const { orgId, schemaId, schemaVersion } = await seedOrgAndSchema(db, 'ticket');
    const created = await repo.create({
      orgId,
      schemaId,
      schemaVersion,
      status: 'open',
      data: { title: 'Printer broken' },
    });
    const fetched = await repo.getById(orgId, created.id);
    expect(fetched?.status).toBe('open');
    expect(fetched?.data).toEqual({ title: 'Printer broken' });
  });

  it('does not return a record for a different org', async () => {
    const a = await seedOrgAndSchema(db, 'ticket');
    const b = await seedOrgAndSchema(db, 'ticket');
    const created = await repo.create({ orgId: a.orgId, schemaId: a.schemaId, schemaVersion: a.schemaVersion });
    expect(await repo.getById(b.orgId, created.id)).toBeUndefined();
  });

  it('updates fields and bumps updated_at', async () => {
    const { orgId, schemaId, schemaVersion } = await seedOrgAndSchema(db, 'ticket');
    const created = await repo.create({ orgId, schemaId, schemaVersion, status: 'open' });
    const updated = await repo.update(orgId, created.id, { status: 'closed' });
    expect(updated?.status).toBe('closed');
    expect(updated!.updatedAt.getTime()).toBeGreaterThanOrEqual(created.updatedAt.getTime());
  });

  it('soft-deletes: hidden from get and list but row remains', async () => {
    const { orgId, schemaId, schemaVersion } = await seedOrgAndSchema(db, 'ticket');
    const created = await repo.create({ orgId, schemaId, schemaVersion });
    await repo.softDelete(orgId, created.id);
    expect(await repo.getById(orgId, created.id)).toBeUndefined();
    expect(await repo.list(orgId, {})).toHaveLength(0);
  });

  it('lists by equality on a system column with pagination', async () => {
    const { orgId, schemaId, schemaVersion } = await seedOrgAndSchema(db, 'ticket');
    await repo.create({ orgId, schemaId, schemaVersion, status: 'open' });
    await repo.create({ orgId, schemaId, schemaVersion, status: 'open' });
    await repo.create({ orgId, schemaId, schemaVersion, status: 'closed' });
    const open = await repo.list(orgId, { status: 'open' });
    expect(open).toHaveLength(2);
    const firstPage = await repo.list(orgId, {}, { limit: 2, offset: 0 });
    expect(firstPage).toHaveLength(2);
    const secondPage = await repo.list(orgId, {}, { limit: 2, offset: 2 });
    expect(secondPage).toHaveLength(1);
  });
});
