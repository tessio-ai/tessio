// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { createTestDb, resetDb, seedOrgAndSchema } from '../testing/test-db';
import { ticketsRepo } from './tickets';
import { recordActivity, listActivity } from './activity';

const db = createTestDb();

describe('activity repository', () => {
  beforeEach(async () => {
    await resetDb(db);
  });
  afterAll(async () => {
    await db.$client.end();
  });

  it('appends events and lists them newest-first for a record', async () => {
    const { orgId, schemaId, schemaVersion } = await seedOrgAndSchema(db, 'ticket');
    const ticket = await ticketsRepo(db).create({ orgId, schemaId, schemaVersion });
    await recordActivity(db, { orgId, recordType: 'ticket', recordId: ticket.id, eventType: 'ticket.created' });
    await recordActivity(db, {
      orgId,
      recordType: 'ticket',
      recordId: ticket.id,
      eventType: 'ticket.status_changed',
      changes: { status: { from: 'open', to: 'closed' } },
    });
    const events = await listActivity(db, orgId, 'ticket', ticket.id);
    expect(events).toHaveLength(2);
    expect(events[0].eventType).toBe('ticket.status_changed');
    expect(events[0].changes).toEqual({ status: { from: 'open', to: 'closed' } });
  });
});
