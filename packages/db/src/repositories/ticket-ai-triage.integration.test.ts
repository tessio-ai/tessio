// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { createTestDb, resetDb, seedOrgAndSchema } from '../testing/test-db';
import { ticketsRepo } from './tickets';
import { ticketAiTriageRepo } from './ticket-ai-triage';

const db = createTestDb();

describe('ticketAiTriageRepo', () => {
  beforeEach(async () => { await resetDb(db); });
  afterAll(async () => { await db.$client.end(); });

  async function makeTicket() {
    const { orgId, schemaId, schemaVersion } = await seedOrgAndSchema(db, 'ticket');
    const ticket = await ticketsRepo(db).create({ orgId, schemaId, schemaVersion });
    return { ticketId: ticket.id, orgId };
  }

  it('get returns undefined before any triage', async () => {
    const { ticketId } = await makeTicket();
    const result = await ticketAiTriageRepo(db).get(ticketId);
    expect(result).toBeUndefined();
  });

  it('upsert inserts a row with the expected fields', async () => {
    const { ticketId } = await makeTicket();
    const row = await ticketAiTriageRepo(db).upsert({
      ticketId,
      category: 'billing',
      priority: 'high',
      suggestedAssigneeId: null,
      confidence: 0.9,
      reasoning: 'Looks like a billing issue',
    });
    expect(row).toBeDefined();
    expect(row!.ticketId).toBe(ticketId);
    expect(row!.category).toBe('billing');
    expect(row!.priority).toBe('high');
    expect(row!.confidence).toBeCloseTo(0.9);
    expect(row!.reasoning).toBe('Looks like a billing issue');
    expect(row!.triagedAt).toBeInstanceOf(Date);
  });

  it('a second upsert for the same ticketId updates in place — only one row, fields changed', async () => {
    const { ticketId } = await makeTicket();

    await ticketAiTriageRepo(db).upsert({
      ticketId,
      category: 'billing',
      priority: 'high',
      suggestedAssigneeId: null,
      confidence: 0.9,
      reasoning: 'First triage',
    });

    const updated = await ticketAiTriageRepo(db).upsert({
      ticketId,
      category: 'technical',
      priority: 'low',
      suggestedAssigneeId: null,
      confidence: 0.5,
      reasoning: 'Second triage',
    });

    expect(updated!.category).toBe('technical');
    expect(updated!.priority).toBe('low');
    expect(updated!.confidence).toBeCloseTo(0.5);
    expect(updated!.reasoning).toBe('Second triage');

    // Verify only one row in the DB for this ticket
    const { ticketAiTriage } = await import('../schema');
    const { eq } = await import('drizzle-orm');
    const rows = await db.select().from(ticketAiTriage).where(eq(ticketAiTriage.ticketId, ticketId));
    expect(rows).toHaveLength(1);
  });
});
