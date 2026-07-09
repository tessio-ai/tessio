// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { sql } from 'drizzle-orm';
import { createTestDb, resetDb, seedOrgAndSchema } from '../testing/test-db';
import { ticketsRepo } from '../repositories/tickets';
import { csatResponsesRepo } from '../repositories/csat-responses';
import { users, schemas, ticketAiTriage, teams, teamSchemas, teamMembers } from '../schema';
import { runReport } from './run-report';
import type { ReportDefinition } from '@tessio/shared';

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

describe('runReport', () => {
  beforeEach(async () => {
    await resetDb(db);
  });

  it('count grouped by status: rows sum to ticket total, ordered value desc', async () => {
    const { orgId, schemaId, schemaVersion } = await seedOrgAndSchema(db, 'ticket');
    const repo = ticketsRepo(db);
    await repo.create({ orgId, schemaId, schemaVersion, status: 'open' });
    await repo.create({ orgId, schemaId, schemaVersion, status: 'open' });
    await repo.create({ orgId, schemaId, schemaVersion, status: 'open' });
    await repo.create({ orgId, schemaId, schemaVersion, status: 'in_progress' });
    await repo.create({ orgId, schemaId, schemaVersion, status: 'resolved' });

    const def: ReportDefinition = {
      source: 'tickets',
      measure: { id: 'count' },
      groupBy: { field: 'status' },
      visualization: 'bar',
    };
    const result = await runReport(db, orgId, def, { userId: 'admin-user', role: 'admin' });
    expect(result.rows).toHaveLength(3);
    const total = result.rows.reduce((sum, r) => sum + r.value, 0);
    expect(total).toBe(5);
    // ordered value desc
    expect(result.rows[0].value).toBeGreaterThanOrEqual(result.rows[1].value);
    expect(result.rows[1].value).toBeGreaterThanOrEqual(result.rows[2].value);
    // top row should be 'open' with 3
    expect(result.rows[0].key).toBe('open');
    expect(result.rows[0].value).toBe(3);
  });

  it('avg_resolution_hours (no group): single row with expected average', async () => {
    const { orgId, schemaId, schemaVersion } = await seedOrgAndSchema(db, 'ticket');
    const repo = ticketsRepo(db);

    // Two resolved tickets: 2h and 4h resolution time
    const t1 = await repo.create({ orgId, schemaId, schemaVersion, status: 'resolved' });
    const t2 = await repo.create({ orgId, schemaId, schemaVersion, status: 'resolved' });
    // One unresolved — should not affect avg
    await repo.create({ orgId, schemaId, schemaVersion, status: 'open' });

    // Set createdAt and resolvedAt via raw update to control exact values
    await db.execute(
      sql`UPDATE tickets SET created_at = '2026-01-01T00:00:00Z', resolved_at = '2026-01-01T02:00:00Z' WHERE id = ${t1.id}`,
    );
    await db.execute(
      sql`UPDATE tickets SET created_at = '2026-01-01T00:00:00Z', resolved_at = '2026-01-01T04:00:00Z' WHERE id = ${t2.id}`,
    );

    const def: ReportDefinition = {
      source: 'tickets',
      measure: { id: 'avg_resolution_hours' },
      visualization: 'number',
    };
    const result = await runReport(db, orgId, def, { userId: 'admin-user', role: 'admin' });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].key).toBeNull();
    // avg of 2h and 4h = 3h
    expect(result.rows[0].value).toBeCloseTo(3, 1);
  });

  it('avg_ai_confidence, count_triaged, count_flagged from triage rows', async () => {
    const { orgId, schemaId, schemaVersion } = await seedOrgAndSchema(db, 'ticket');
    const repo = ticketsRepo(db);
    const t1 = await repo.create({ orgId, schemaId, schemaVersion, status: 'open' });
    const t2 = await repo.create({ orgId, schemaId, schemaVersion, status: 'open' });
    const t3 = await repo.create({ orgId, schemaId, schemaVersion, status: 'open' });

    await db.insert(ticketAiTriage).values({ ticketId: t1.id, confidence: 0.9, category: 'bug' });
    await db.insert(ticketAiTriage).values({ ticketId: t2.id, confidence: 0.5, category: 'feature' }); // flagged (< 0.6)
    await db.insert(ticketAiTriage).values({ ticketId: t3.id, confidence: 0.8, category: 'support' });

    const adminScope = { userId: 'admin-user', role: 'admin' as const };

    // avg_ai_confidence: (0.9 + 0.5 + 0.8) / 3 = 0.7333
    const defAvg: ReportDefinition = { source: 'tickets', measure: { id: 'avg_ai_confidence' }, visualization: 'number' };
    const avgResult = await runReport(db, orgId, defAvg, adminScope);
    expect(avgResult.rows[0].value).toBeCloseTo(0.7333, 2);

    // count_triaged: 3
    const defTriaged: ReportDefinition = { source: 'tickets', measure: { id: 'count_triaged' }, visualization: 'number' };
    const triagedResult = await runReport(db, orgId, defTriaged, adminScope);
    expect(triagedResult.rows[0].value).toBe(3);

    // count_flagged: 1 (only confidence < 0.6)
    const defFlagged: ReportDefinition = { source: 'tickets', measure: { id: 'count_flagged' }, visualization: 'number' };
    const flaggedResult = await runReport(db, orgId, defFlagged, adminScope);
    expect(flaggedResult.rows[0].value).toBe(1);
  });

  it('count grouped by createdAt with dateBucket:day: one row per day, ascending, ISO keys', async () => {
    const { orgId, schemaId, schemaVersion } = await seedOrgAndSchema(db, 'ticket');
    const repo = ticketsRepo(db);

    const t1 = await repo.create({ orgId, schemaId, schemaVersion, status: 'open' });
    const t2 = await repo.create({ orgId, schemaId, schemaVersion, status: 'open' });
    const t3 = await repo.create({ orgId, schemaId, schemaVersion, status: 'open' });

    // Set distinct days
    await db.execute(sql`UPDATE tickets SET created_at = '2026-01-01T10:00:00Z' WHERE id = ${t1.id}`);
    await db.execute(sql`UPDATE tickets SET created_at = '2026-01-02T10:00:00Z' WHERE id = ${t2.id}`);
    await db.execute(sql`UPDATE tickets SET created_at = '2026-01-03T10:00:00Z' WHERE id = ${t3.id}`);

    const def: ReportDefinition = {
      source: 'tickets',
      measure: { id: 'count' },
      groupBy: { field: 'createdAt', dateBucket: 'day' },
      visualization: 'line',
    };
    const result = await runReport(db, orgId, def, { userId: 'admin-user', role: 'admin' });
    expect(result.rows).toHaveLength(3);
    // ordered ascending for date dims
    expect(result.rows[0].key).toBe('2026-01-01');
    expect(result.rows[1].key).toBe('2026-01-02');
    expect(result.rows[2].key).toBe('2026-01-03');
    // all keys are ISO YYYY-MM-DD
    for (const row of result.rows) {
      expect(row.key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('filter (status eq open) restricts the rows', async () => {
    const { orgId, schemaId, schemaVersion } = await seedOrgAndSchema(db, 'ticket');
    const repo = ticketsRepo(db);
    await repo.create({ orgId, schemaId, schemaVersion, status: 'open' });
    await repo.create({ orgId, schemaId, schemaVersion, status: 'open' });
    await repo.create({ orgId, schemaId, schemaVersion, status: 'resolved' });

    const def: ReportDefinition = {
      source: 'tickets',
      measure: { id: 'count' },
      filter: { field: 'status', op: 'eq', value: 'open' },
      visualization: 'number',
    };
    const result = await runReport(db, orgId, def, { userId: 'admin-user', role: 'admin' });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].value).toBe(2);
  });

  it('team-scoping: agent only sees their team tickets', async () => {
    const { orgId, schemaId: schemaIdA, schemaVersion: svA } = await seedOrgAndSchema(db, 'ticket');

    // Create a second schema in the same org for team 2
    const [schemaB] = await db
      .insert(schemas)
      .values({
        orgId,
        kind: 'ticket' as const,
        key: `ticket_team2_${crypto.randomUUID()}`,
        name: 'Team B Schema',
        status: 'published' as const,
        definition: { fields: [] },
      })
      .returning();

    const userId = await mkUser(orgId);

    // Team 1: user is a member, owns schemaIdA
    const [team1] = await db
      .insert(teams)
      .values({ orgId, name: 'Team Alpha' })
      .returning();
    await db.insert(teamSchemas).values({ teamId: team1.id, schemaId: schemaIdA });
    await db.insert(teamMembers).values({ teamId: team1.id, userId });

    // Team 2: user is NOT a member, owns schemaB.id
    const [team2] = await db
      .insert(teams)
      .values({ orgId, name: 'Team Beta' })
      .returning();
    await db.insert(teamSchemas).values({ teamId: team2.id, schemaId: schemaB.id });

    // Tickets in schemaIdA (team1 — agent CAN see)
    const repo = ticketsRepo(db);
    await repo.create({ orgId, schemaId: schemaIdA, schemaVersion: svA, status: 'open' });
    await repo.create({ orgId, schemaId: schemaIdA, schemaVersion: svA, status: 'open' });

    // Tickets in schemaB.id (team2 — agent CANNOT see)
    await repo.create({ orgId, schemaId: schemaB.id, schemaVersion: schemaB.version, status: 'open' });
    await repo.create({ orgId, schemaId: schemaB.id, schemaVersion: schemaB.version, status: 'open' });
    await repo.create({ orgId, schemaId: schemaB.id, schemaVersion: schemaB.version, status: 'open' });

    const def: ReportDefinition = {
      source: 'tickets',
      measure: { id: 'count' },
      visualization: 'number',
    };

    // Admin sees all 5
    const adminResult = await runReport(db, orgId, def, { userId, role: 'admin' });
    expect(adminResult.rows[0].value).toBe(5);

    // Agent sees only 2 (their team's schema)
    const agentResult = await runReport(db, orgId, def, { userId, role: 'agent' });
    expect(agentResult.rows[0].value).toBe(2);
  });

  it('unknown measure id throws', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    const def: ReportDefinition = {
      source: 'tickets',
      measure: { id: 'nonexistent_measure_xyz' },
      visualization: 'number',
    };
    await expect(runReport(db, orgId, def, { userId: 'admin', role: 'admin' })).rejects.toThrow(/Unknown measure/);
  });

  it('data.<key> measure: avg of numeric custom field (no group)', async () => {
    const { orgId, schemaId, schemaVersion } = await seedOrgAndSchema(db, 'ticket');
    const repo = ticketsRepo(db);
    // score: 5 and score: 15 → avg = 10
    await repo.create({ orgId, schemaId, schemaVersion, status: 'open', data: { score: 5 } });
    await repo.create({ orgId, schemaId, schemaVersion, status: 'open', data: { score: 15 } });
    // ticket without score field — coalesce treats null numeric as excluded from avg
    await repo.create({ orgId, schemaId, schemaVersion, status: 'open' });

    const def: ReportDefinition = {
      source: 'tickets',
      measure: { id: 'data.score', fn: 'avg' },
      visualization: 'number',
    };
    const result = await runReport(db, orgId, def, { userId: 'admin', role: 'admin' });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].key).toBeNull();
    expect(result.rows[0].value).toBeCloseTo(10, 1);
  });

  it('data.<key> dimension: count grouped by string custom field', async () => {
    const { orgId, schemaId, schemaVersion } = await seedOrgAndSchema(db, 'ticket');
    const repo = ticketsRepo(db);
    await repo.create({ orgId, schemaId, schemaVersion, status: 'open', data: { region: 'us' } });
    await repo.create({ orgId, schemaId, schemaVersion, status: 'open', data: { region: 'us' } });
    await repo.create({ orgId, schemaId, schemaVersion, status: 'open', data: { region: 'eu' } });

    const def: ReportDefinition = {
      source: 'tickets',
      measure: { id: 'count' },
      groupBy: { field: 'data.region' },
      visualization: 'bar',
    };
    const result = await runReport(db, orgId, def, { userId: 'admin', role: 'admin' });
    // two distinct region buckets
    expect(result.rows).toHaveLength(2);
    const total = result.rows.reduce((sum, r) => sum + r.value, 0);
    expect(total).toBe(3);
    const usRow = result.rows.find((r) => r.key === 'us');
    const euRow = result.rows.find((r) => r.key === 'eu');
    expect(usRow?.value).toBe(2);
    expect(euRow?.value).toBe(1);
  });

  it('pct_triaged (no group): 100 * triaged / total', async () => {
    const { orgId, schemaId, schemaVersion } = await seedOrgAndSchema(db, 'ticket');
    const repo = ticketsRepo(db);
    const t1 = await repo.create({ orgId, schemaId, schemaVersion, status: 'open' });
    const t2 = await repo.create({ orgId, schemaId, schemaVersion, status: 'open' });
    await repo.create({ orgId, schemaId, schemaVersion, status: 'open' }); // not triaged
    await repo.create({ orgId, schemaId, schemaVersion, status: 'open' }); // not triaged

    // 2 out of 4 triaged → 50%
    await db.insert(ticketAiTriage).values({ ticketId: t1.id, confidence: 0.9, category: 'bug' });
    await db.insert(ticketAiTriage).values({ ticketId: t2.id, confidence: 0.7, category: 'feature' });

    const def: ReportDefinition = {
      source: 'tickets',
      measure: { id: 'pct_triaged' },
      visualization: 'number',
    };
    const result = await runReport(db, orgId, def, { userId: 'admin', role: 'admin' });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].value).toBeCloseTo(50, 1);
  });

  it('min_ai_confidence (no group): returns minimum confidence across triaged tickets', async () => {
    const { orgId, schemaId, schemaVersion } = await seedOrgAndSchema(db, 'ticket');
    const repo = ticketsRepo(db);
    const t1 = await repo.create({ orgId, schemaId, schemaVersion, status: 'open' });
    const t2 = await repo.create({ orgId, schemaId, schemaVersion, status: 'open' });
    const t3 = await repo.create({ orgId, schemaId, schemaVersion, status: 'open' });

    await db.insert(ticketAiTriage).values({ ticketId: t1.id, confidence: 0.9, category: 'bug' });
    await db.insert(ticketAiTriage).values({ ticketId: t2.id, confidence: 0.4, category: 'feature' });
    await db.insert(ticketAiTriage).values({ ticketId: t3.id, confidence: 0.75, category: 'support' });

    const def: ReportDefinition = {
      source: 'tickets',
      measure: { id: 'min_ai_confidence' },
      visualization: 'number',
    };
    const result = await runReport(db, orgId, def, { userId: 'admin', role: 'admin' });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].value).toBeCloseTo(0.4, 3);
  });

  it('max_resolution_hours (no group): returns maximum resolution time', async () => {
    const { orgId, schemaId, schemaVersion } = await seedOrgAndSchema(db, 'ticket');
    const repo = ticketsRepo(db);
    const t1 = await repo.create({ orgId, schemaId, schemaVersion, status: 'resolved' });
    const t2 = await repo.create({ orgId, schemaId, schemaVersion, status: 'resolved' });
    // Unresolved — excluded from the max
    await repo.create({ orgId, schemaId, schemaVersion, status: 'open' });

    // t1: 6h, t2: 2h → max = 6h
    await db.execute(
      sql`UPDATE tickets SET created_at = '2026-01-01T00:00:00Z', resolved_at = '2026-01-01T06:00:00Z' WHERE id = ${t1.id}`,
    );
    await db.execute(
      sql`UPDATE tickets SET created_at = '2026-01-01T00:00:00Z', resolved_at = '2026-01-01T02:00:00Z' WHERE id = ${t2.id}`,
    );

    const def: ReportDefinition = {
      source: 'tickets',
      measure: { id: 'max_resolution_hours' },
      visualization: 'number',
    };
    const result = await runReport(db, orgId, def, { userId: 'admin', role: 'admin' });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].value).toBeCloseTo(6, 1);
  });

  it('csat measures: avg rating, response count, and response rate over sent surveys', async () => {
    const { orgId, schemaId, schemaVersion } = await seedOrgAndSchema(db, 'ticket');
    const repo = ticketsRepo(db);
    const csat = csatResponsesRepo(db);
    const t1 = await repo.create({ orgId, schemaId, schemaVersion, status: 'resolved' });
    const t2 = await repo.create({ orgId, schemaId, schemaVersion, status: 'closed' });
    const t3 = await repo.create({ orgId, schemaId, schemaVersion, status: 'resolved' });
    await repo.create({ orgId, schemaId, schemaVersion, status: 'open' }); // never surveyed

    // Two answered surveys (5 and 2), one sent-but-unanswered.
    const requesterId = await mkUser(orgId);
    await csat.submit({ orgId, ticketId: t1.id, requesterId, rating: 5, comment: null });
    await csat.submit({ orgId, ticketId: t2.id, requesterId, rating: 2, comment: null });
    await csat.createSurvey({ orgId, ticketId: t3.id, requesterId });

    const adminScope = { userId: 'admin', role: 'admin' as const };

    const avg = await runReport(db, orgId, { source: 'tickets', measure: { id: 'avg_csat' }, visualization: 'number' }, adminScope);
    expect(avg.rows[0].value).toBeCloseTo(3.5, 3); // (5 + 2) / 2

    const count = await runReport(db, orgId, { source: 'tickets', measure: { id: 'count_csat_responses' }, visualization: 'number' }, adminScope);
    expect(count.rows[0].value).toBe(2);

    const rate = await runReport(db, orgId, { source: 'tickets', measure: { id: 'pct_csat_responded' }, visualization: 'number' }, adminScope);
    expect(rate.rows[0].value).toBeCloseTo(66.667, 1); // 2 answered of 3 sent

    // grouped by rating: distribution buckets
    const dist = await runReport(db, orgId, { source: 'tickets', measure: { id: 'count_csat_responses' }, groupBy: { field: 'csat.rating' }, visualization: 'bar' }, adminScope);
    const byKey = Object.fromEntries(dist.rows.map((r) => [r.key, r.value]));
    expect(byKey['5']).toBe(1);
    expect(byKey['2']).toBe(1);
  });

  it('date-range preset 30d: only counts tickets created within last 30 days', async () => {
    const { orgId, schemaId, schemaVersion } = await seedOrgAndSchema(db, 'ticket');
    const repo = ticketsRepo(db);

    // 3 recent tickets (within last 30 days — use today's date)
    const r1 = await repo.create({ orgId, schemaId, schemaVersion, status: 'open' });
    const r2 = await repo.create({ orgId, schemaId, schemaVersion, status: 'open' });
    const r3 = await repo.create({ orgId, schemaId, schemaVersion, status: 'open' });

    // 1 old ticket created 200 days ago — outside 30d window
    const old = await repo.create({ orgId, schemaId, schemaVersion, status: 'open' });
    const oldDate = new Date(Date.now() - 200 * 86_400_000).toISOString();
    await db.execute(sql`UPDATE tickets SET created_at = ${oldDate} WHERE id = ${old.id}`);

    // Keep r1/r2/r3 at their default created_at (just now), only push old ticket back
    // Touch r1/r2/r3 to a stable recent timestamp (5 days ago) so they're inside the window
    const recentDate = new Date(Date.now() - 5 * 86_400_000).toISOString();
    await db.execute(sql`UPDATE tickets SET created_at = ${recentDate} WHERE id = ${r1.id}`);
    await db.execute(sql`UPDATE tickets SET created_at = ${recentDate} WHERE id = ${r2.id}`);
    await db.execute(sql`UPDATE tickets SET created_at = ${recentDate} WHERE id = ${r3.id}`);

    const def: ReportDefinition = {
      source: 'tickets',
      measure: { id: 'count' },
      dateRange: { field: 'createdAt', preset: '30d' },
      visualization: 'number',
    };
    const result = await runReport(db, orgId, def, { userId: 'admin', role: 'admin' });
    expect(result.rows).toHaveLength(1);
    // only the 3 recent tickets should be counted
    expect(result.rows[0].value).toBe(3);
  });
});
