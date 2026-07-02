// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { createTestDb, resetDb, seedOrgAndSchema } from '../testing/test-db';
import { attachmentsRepo } from './attachments';

const db = createTestDb();
const repo = attachmentsRepo(db);
const base = (orgId: string, recordId: string) => ({ orgId, recordType: 'ticket' as const, recordId,
  filename: 'a.txt', size: 5, mime: 'text/plain', storageKey: `${orgId}/x`, uploadedBy: null });

describe('attachmentsRepo', () => {
  beforeEach(async () => { await resetDb(db); });
  afterAll(async () => { await db.$client.end(); });

  it('creates and lists by (org, recordType, recordId)', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    const rid = crypto.randomUUID();
    await repo.create(base(orgId, rid));
    const list = await repo.list(orgId, 'ticket', rid);
    expect(list).toHaveLength(1);
    expect(list[0].filename).toBe('a.txt');
  });

  it('findById is org-scoped and remove deletes', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    const rid = crypto.randomUUID();
    const created = await repo.create(base(orgId, rid));
    expect((await repo.findById(orgId, created.id))?.id).toBe(created.id);
    await repo.remove(orgId, created.id);
    expect(await repo.findById(orgId, created.id)).toBeUndefined();
  });
});
