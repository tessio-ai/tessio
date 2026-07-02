// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { createTestDb, resetDb } from '../testing/test-db';
import { orgs } from '../schema';
import { usersRepo } from './users';
import { sessionsRepo } from './sessions';

const db = createTestDb();
async function makeUser(role: 'admin' | 'agent' | 'requester' = 'agent') {
  const [org] = await db.insert(orgs).values({ name: 'Org', slug: `o-${crypto.randomUUID()}` }).returning();
  const user = await usersRepo(db).create({ orgId: org.id, email: `${crypto.randomUUID()}@t.io`, name: 'U', role, passwordHash: 'h' });
  return { orgId: org.id, user };
}

describe('sessionsRepo', () => {
  beforeEach(async () => { await resetDb(db); });
  afterAll(async () => { await db.$client.end(); });

  it('creates a valid session and finds it with its user', async () => {
    const { orgId, user } = await makeUser();
    const s = await sessionsRepo(db).create({ userId: user.id, orgId });
    const found = await sessionsRepo(db).findValid(s.id);
    expect(found?.user.id).toBe(user.id);
    expect(found?.session.orgId).toBe(orgId);
  });

  it('does not find an expired session', async () => {
    const { orgId, user } = await makeUser();
    const s = await sessionsRepo(db).create({ userId: user.id, orgId, ttlMs: -1000 });
    expect(await sessionsRepo(db).findValid(s.id)).toBeUndefined();
  });

  it('does not find a session for a disabled user', async () => {
    const { orgId, user } = await makeUser();
    const s = await sessionsRepo(db).create({ userId: user.id, orgId });
    await usersRepo(db).setStatus(user.id, 'disabled');
    expect(await sessionsRepo(db).findValid(s.id)).toBeUndefined();
  });

  it('delete removes the session', async () => {
    const { orgId, user } = await makeUser();
    const s = await sessionsRepo(db).create({ userId: user.id, orgId });
    await sessionsRepo(db).delete(s.id);
    expect(await sessionsRepo(db).findValid(s.id)).toBeUndefined();
  });
});
