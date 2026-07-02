// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import {
  createTestDb,
  resetDb,
  seedOrgAndSchema,
} from '@tessio/db/testing';
import {
  ticketsRepo,
  usersRepo,
  notificationsRepo,
} from '@tessio/db';
import { buildSlaDeps } from './wire';
import { runSlaTick } from './tick';

// ---------------------------------------------------------------------------
// Shared DB
// ---------------------------------------------------------------------------
const db = createTestDb();

beforeEach(async () => {
  await resetDb(db);
});

afterAll(async () => {
  await db.$client.end();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('runSlaTick — integration', () => {
  it('stamps slaResolutionBreachedAt and notifies assignee once (idempotent)', async () => {
    // -----------------------------------------------------------------------
    // 1. Seed org + ticket schema; create requester and assignee users.
    // -----------------------------------------------------------------------
    const { orgId, schemaId, schemaVersion } = await seedOrgAndSchema(db, 'ticket');

    const requester = await usersRepo(db).create({
      orgId,
      email: 'requester@test.io',
      name: 'Requester',
      role: 'requester',
      passwordHash: 'h',
    });

    const assignee = await usersRepo(db).create({
      orgId,
      email: 'assignee@test.io',
      name: 'Assignee',
      role: 'agent',
      passwordHash: 'h',
    });

    // -----------------------------------------------------------------------
    // 2. Create a ticket with assigneeId; then set its SLA resolution target
    //    to 2026-06-11T11:00:00Z so it's breached at 12:00.
    // -----------------------------------------------------------------------
    const ticket = await ticketsRepo(db).create({
      orgId,
      schemaId,
      schemaVersion,
      requesterId: requester.id,
      assigneeId: assignee.id,
    });

    await ticketsRepo(db).setSlaTargets(orgId, ticket.id, {
      responseDueAt: null,
      resolutionDueAt: new Date('2026-06-11T11:00:00Z'),
    });

    // -----------------------------------------------------------------------
    // 3. Build deps: real DB, fixed "now" = 12:00 UTC (after the due time).
    // -----------------------------------------------------------------------
    const deps = {
      ...buildSlaDeps(db),
      now: () => new Date('2026-06-11T12:00:00Z'),
    };

    // -----------------------------------------------------------------------
    // 4. Run the tick.
    // -----------------------------------------------------------------------
    await runSlaTick(deps);

    // -----------------------------------------------------------------------
    // 5a. slaResolutionBreachedAt is now stamped on the ticket.
    // -----------------------------------------------------------------------
    const candidates = await ticketsRepo(db).listSlaBreachCandidates(new Date('2026-06-11T12:00:00Z'));
    // The ticket should no longer be a candidate (breach was stamped).
    const stillBreaching = candidates.find((c) => c.id === ticket.id);
    expect(stillBreaching).toBeUndefined();

    // Confirm via notifications that it was processed.
    const notifs = await notificationsRepo(db).list(orgId, assignee.id);
    expect(notifs).toHaveLength(1);
    expect(notifs[0].type).toBe('sla');
    expect(notifs[0].ticketId).toBe(ticket.id);

    // -----------------------------------------------------------------------
    // 5b. Second tick is idempotent — no second notification created.
    // -----------------------------------------------------------------------
    await runSlaTick(deps);

    const notifsAfter = await notificationsRepo(db).list(orgId, assignee.id);
    expect(notifsAfter).toHaveLength(1);
  });
});
