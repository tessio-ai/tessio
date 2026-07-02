// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { and, eq, isNull } from 'drizzle-orm';
import { createTestDb, resetDb, seedOrgAndSchema } from '../testing/test-db';
import { tickets } from '../schema';
import { ticketsRepo } from '../repositories/tickets';
import { usersRepo } from '../repositories/users';
import { compileFilter } from './compile-filter';
import type { FilterNode } from '@tessio/shared';

const db = createTestDb();

/** Run a compiled filter against tickets for one org; return matching rows. */
async function find(orgId: string, filter: FilterNode) {
  return db
    .select()
    .from(tickets)
    .where(and(eq(tickets.orgId, orgId), isNull(tickets.deletedAt), compileFilter(tickets, filter)));
}

describe('compileFilter (against tickets)', () => {
  beforeEach(async () => {
    await resetDb(db);
  });
  afterAll(async () => {
    await db.$client.end();
  });

  it('filters by equality on a system column', async () => {
    const { orgId, schemaId, schemaVersion } = await seedOrgAndSchema(db, 'ticket');
    const repo = ticketsRepo(db);
    await repo.create({ orgId, schemaId, schemaVersion, status: 'open' });
    await repo.create({ orgId, schemaId, schemaVersion, status: 'closed' });
    const rows = await find(orgId, { field: 'status', op: 'eq', value: 'open' });
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('open');
  });

  it('supports and / or / not nesting', async () => {
    const { orgId, schemaId, schemaVersion } = await seedOrgAndSchema(db, 'ticket');
    const repo = ticketsRepo(db);
    await repo.create({ orgId, schemaId, schemaVersion, status: 'open', priority: 'high' });
    await repo.create({ orgId, schemaId, schemaVersion, status: 'open', priority: 'low' });
    await repo.create({ orgId, schemaId, schemaVersion, status: 'closed', priority: 'high' });
    const rows = await find(orgId, {
      and: [
        { field: 'status', op: 'eq', value: 'open' },
        { not: { field: 'priority', op: 'eq', value: 'low' } },
      ],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].priority).toBe('high');
  });

  it('supports the in operator on a system column', async () => {
    const { orgId, schemaId, schemaVersion } = await seedOrgAndSchema(db, 'ticket');
    const repo = ticketsRepo(db);
    await repo.create({ orgId, schemaId, schemaVersion, status: 'open' });
    await repo.create({ orgId, schemaId, schemaVersion, status: 'pending' });
    await repo.create({ orgId, schemaId, schemaVersion, status: 'closed' });
    const rows = await find(orgId, { field: 'status', op: 'in', value: ['open', 'pending'] });
    expect(rows.map((r) => r.status).sort()).toEqual(['open', 'pending']);
  });

  it('supports contains / startsWith on text', async () => {
    const { orgId, schemaId, schemaVersion } = await seedOrgAndSchema(db, 'ticket');
    const repo = ticketsRepo(db);
    await repo.create({ orgId, schemaId, schemaVersion, status: 'awaiting-customer' });
    await repo.create({ orgId, schemaId, schemaVersion, status: 'done' });
    expect(await find(orgId, { field: 'status', op: 'contains', value: 'wait' })).toHaveLength(1);
    expect(await find(orgId, { field: 'status', op: 'startsWith', value: 'await' })).toHaveLength(1);
  });

  it('filters and casts a numeric JSONB custom field', async () => {
    const { orgId, schemaId, schemaVersion } = await seedOrgAndSchema(db, 'ticket');
    const repo = ticketsRepo(db);
    await repo.create({ orgId, schemaId, schemaVersion, data: { cost: 150 } });
    await repo.create({ orgId, schemaId, schemaVersion, data: { cost: 50 } });
    const rows = await find(orgId, { field: 'data.cost', op: 'gt', value: 100, type: 'number' });
    expect(rows).toHaveLength(1);
    expect(rows[0].data).toEqual({ cost: 150 });
  });

  it('handles isNull on a system column', async () => {
    const { orgId, schemaId, schemaVersion } = await seedOrgAndSchema(db, 'ticket');
    const repo = ticketsRepo(db);
    const assignee = await usersRepo(db).create({ orgId, email: `a-${crypto.randomUUID()}@t.io`, name: 'A', role: 'agent', passwordHash: 'h' });
    await repo.create({ orgId, schemaId, schemaVersion, assigneeId: null });
    await repo.create({ orgId, schemaId, schemaVersion, assigneeId: assignee.id });
    const rows = await find(orgId, { field: 'assigneeId', op: 'isNull' });
    expect(rows).toHaveLength(1);
    expect(rows[0].assigneeId).toBeNull();
  });

  it('rejects an unknown system field (injection guard)', () => {
    expect(() => compileFilter(tickets, { field: 'status; DROP TABLE tickets', op: 'eq', value: 'x' })).toThrow();
  });

  it('rejects a malformed JSONB key', () => {
    expect(() => compileFilter(tickets, { field: "data.bad'key", op: 'eq', value: 'x' })).toThrow();
  });
});
