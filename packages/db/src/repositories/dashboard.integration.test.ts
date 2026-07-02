// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { createTestDb, resetDb, seedOrgAndSchema } from '../testing/test-db';
import { ticketsRepo, dashboardRepo } from '../index';
import { users } from '../schema';

const db = createTestDb();
afterAll(async () => {
  await db.$client.end();
});

async function mkUser(orgId: string): Promise<string> {
  const [u] = await db
    .insert(users)
    .values({ orgId, email: `u-${crypto.randomUUID()}@x.io`, name: 'Agent', passwordHash: 'x', role: 'agent' })
    .returning();
  return u.id;
}

describe('dashboardRepo.stats', () => {
  beforeEach(async () => {
    await resetDb(db);
  });

  it('aggregates open counts, status breakdown, series, and tess activity (org-scoped)', async () => {
    const { orgId, schemaId, schemaVersion } = await seedOrgAndSchema(db, 'ticket');
    const me = await mkUser(orgId);
    const tk = (status: string, assigneeId: string | null) =>
      ticketsRepo(db).create({ orgId, schemaId, schemaVersion, status, assigneeId, data: { title: status } } as never);
    await tk('open', me);
    await tk('open', null);
    await tk('in_progress', null);
    await tk('resolved', null); // excluded from "open" aggregates

    // A second org's ticket must never leak into the first org's stats.
    const other = await seedOrgAndSchema(db, 'ticket');
    await ticketsRepo(db).create({ orgId: other.orgId, schemaId: other.schemaId, schemaVersion: other.schemaVersion, status: 'open', data: { title: 'leak' } } as never);

    const s = await dashboardRepo(db).stats(orgId, { userId: me });

    expect(s.myOpen).toBe(1);
    expect(s.unassigned).toBe(2); // the open + in_progress unassigned ones
    const byStatus = Object.fromEntries(s.openByStatus.map((r) => [r.status, r.count]));
    expect(byStatus.open).toBe(2);
    expect(byStatus.in_progress).toBe(1);
    expect(byStatus.resolved).toBeUndefined();
    expect(s.series).toHaveLength(14);
    expect(s.series.reduce((sum, d) => sum + d.created, 0)).toBe(4); // 4 org tickets created today, not the other org's
    expect(s.today.created).toBe(4); // all 4 org tickets were created today
    expect(s.tess).toEqual({ enabled: false, triaged: 0, indexed: 0, flagged: 0 });
    expect(s.recentTess).toEqual([]);
  });
});
