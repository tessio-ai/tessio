// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { createTestDb, resetDb, seedOrgAndSchema } from '../testing/test-db';
import { ticketsRepo } from '../repositories/tickets';
import { viewsRepo } from '../repositories/views';
import { createRecordRepository } from '../repositories/records';
import { tickets } from '../schema';
import type { FilterNode } from '@tessio/shared';

const db = createTestDb();

describe('stored view drives a query', () => {
  beforeEach(async () => {
    await resetDb(db);
  });
  afterAll(async () => {
    await db.$client.end();
  });

  it('round-trips a typed filter and uses it to query records', async () => {
    const { orgId, schemaId, schemaVersion } = await seedOrgAndSchema(db, 'ticket');
    await ticketsRepo(db).create({ orgId, schemaId, schemaVersion, status: 'open' });
    await ticketsRepo(db).create({ orgId, schemaId, schemaVersion, status: 'closed' });

    const filter: FilterNode = { field: 'status', op: 'eq', value: 'open' };
    const view = await viewsRepo(db).create(orgId, { targetKind: 'ticket', name: 'Open', filter });

    const loaded = await viewsRepo(db).getById(orgId, view.id);
    expect(loaded?.filter).toEqual(filter);

    const page = await createRecordRepository(db, tickets).query(orgId, { filter: loaded!.filter ?? undefined });
    expect(page.rows).toHaveLength(1);
    expect(page.rows[0].status).toBe('open');
  });
});
