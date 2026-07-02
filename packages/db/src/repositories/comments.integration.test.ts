// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { createTestDb, resetDb, seedOrgAndSchema } from '../testing/test-db';
import { ticketsRepo } from './tickets';
import { addComment, listComments } from './comments';

const db = createTestDb();

describe('comments repository', () => {
  beforeEach(async () => {
    await resetDb(db);
  });
  afterAll(async () => {
    await db.$client.end();
  });

  it('adds public and internal comments and lists them oldest-first', async () => {
    const { orgId, schemaId, schemaVersion } = await seedOrgAndSchema(db, 'ticket');
    const ticket = await ticketsRepo(db).create({ orgId, schemaId, schemaVersion });
    await addComment(db, { orgId, recordType: 'ticket', recordId: ticket.id, body: 'Looking into it' });
    await addComment(db, { orgId, recordType: 'ticket', recordId: ticket.id, body: 'Internal note', internal: true });
    const all = await listComments(db, orgId, 'ticket', ticket.id);
    expect(all).toHaveLength(2);
    expect(all[0].body).toBe('Looking into it');
    expect(all[0].internal).toBe(false);
    expect(all[1].internal).toBe(true);
  });
});
