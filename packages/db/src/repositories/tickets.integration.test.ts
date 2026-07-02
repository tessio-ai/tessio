// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { createTestDb, resetDb, seedOrgAndSchema } from '../testing/test-db';
import { ticketsRepo } from './tickets';

const db = createTestDb();
const repo = ticketsRepo(db);

describe('ticketsRepo number assignment', () => {
  beforeEach(async () => {
    await resetDb(db);
  });
  afterAll(async () => {
    await db.$client.end();
  });

  it('assigns sequential per-org numbers starting at 1', async () => {
    const { orgId, schemaId, schemaVersion } = await seedOrgAndSchema(db, 'ticket');
    const t1 = await repo.create({ orgId, schemaId, schemaVersion });
    const t2 = await repo.create({ orgId, schemaId, schemaVersion });
    expect(t1.number).toBe(1);
    expect(t2.number).toBe(2);
  });

  it('numbers are independent per org', async () => {
    const a = await seedOrgAndSchema(db, 'ticket');
    const b = await seedOrgAndSchema(db, 'ticket');
    const a1 = await repo.create({ orgId: a.orgId, schemaId: a.schemaId, schemaVersion: a.schemaVersion });
    const b1 = await repo.create({ orgId: b.orgId, schemaId: b.schemaId, schemaVersion: b.schemaVersion });
    expect(a1.number).toBe(1);
    expect(b1.number).toBe(1);
  });

  it('assigns unique numbers under concurrent creates', async () => {
    const { orgId, schemaId, schemaVersion } = await seedOrgAndSchema(db, 'ticket');
    const created = await Promise.all(
      Array.from({ length: 10 }, () => repo.create({ orgId, schemaId, schemaVersion })),
    );
    const numbers = created.map((t) => t.number).sort((x, y) => x! - y!);
    expect(numbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});
