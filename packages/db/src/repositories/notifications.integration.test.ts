// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { createTestDb, resetDb } from '../testing/test-db';
import { orgs } from '../schema';
import { usersRepo } from './users';
import { notificationsRepo } from './notifications';

const db = createTestDb();

async function makeOrgAndUser() {
  const [org] = await db
    .insert(orgs)
    .values({ name: 'Org', slug: `o-${crypto.randomUUID()}` })
    .returning();
  const user = await usersRepo(db).create({
    orgId: org.id,
    email: `${crypto.randomUUID()}@t.io`,
    name: 'U',
    role: 'agent',
    passwordHash: 'h',
  });
  return { orgId: org.id, userId: user.id };
}

describe('notificationsRepo', () => {
  beforeEach(async () => {
    await resetDb(db);
  });
  afterAll(async () => {
    await db.$client.end();
  });

  it('create → unreadCount is 1, markRead → unreadCount is 0', async () => {
    const { orgId, userId } = await makeOrgAndUser();
    const notif = await notificationsRepo(db).create({
      orgId,
      userId,
      type: 'assigned',
      title: 'Ticket assigned to you',
    });
    expect(notif.id).toBeDefined();
    expect(await notificationsRepo(db).unreadCount(orgId, userId)).toBe(1);
    await notificationsRepo(db).markRead(orgId, userId, notif.id);
    expect(await notificationsRepo(db).unreadCount(orgId, userId)).toBe(0);
  });

  it('list returns rows newest-first', async () => {
    const { orgId, userId } = await makeOrgAndUser();
    await notificationsRepo(db).create({ orgId, userId, type: 'reply', title: 'First' });
    // small delay to ensure distinct createdAt ordering
    await new Promise((r) => setTimeout(r, 5));
    await notificationsRepo(db).create({ orgId, userId, type: 'status', title: 'Second' });
    const rows = await notificationsRepo(db).list(orgId, userId);
    expect(rows).toHaveLength(2);
    expect(rows[0].title).toBe('Second');
    expect(rows[1].title).toBe('First');
  });
});
