// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { createTestDb, resetDb } from '../testing/test-db';
import { orgs } from '../schema';
import { usersRepo } from './users';

const db = createTestDb();
async function makeOrg() {
  const [org] = await db.insert(orgs).values({ name: 'Org', slug: `o-${crypto.randomUUID()}` }).returning();
  return org.id;
}

describe('usersRepo', () => {
  beforeEach(async () => { await resetDb(db); });
  afterAll(async () => { await db.$client.end(); });

  it('creates and finds a user by email (case-insensitive)', async () => {
    const orgId = await makeOrg();
    const created = await usersRepo(db).create({ orgId, email: 'Sam@Acme.com', name: 'Sam', role: 'agent', passwordHash: 'h' });
    expect(created.email).toBe('sam@acme.com');
    const found = await usersRepo(db).findByEmail(orgId, 'sam@acme.com');
    expect(found?.id).toBe(created.id);
  });

  it('findByEmailGlobal resolves without an org id', async () => {
    const orgId = await makeOrg();
    const u = await usersRepo(db).create({ orgId, email: 'a@b.io', name: 'A', role: 'admin', passwordHash: 'h' });
    expect((await usersRepo(db).findByEmailGlobal('a@b.io'))?.id).toBe(u.id);
  });

  it('setStatus and setRole update the row', async () => {
    const orgId = await makeOrg();
    const u = await usersRepo(db).create({ orgId, email: 'c@d.io', name: 'C', role: 'requester', passwordHash: 'h' });
    expect((await usersRepo(db).setStatus(u.id, 'disabled'))?.status).toBe('disabled');
    expect((await usersRepo(db).setRole(u.id, 'agent'))?.role).toBe('agent');
  });

  it('lists users for an org', async () => {
    const orgId = await makeOrg();
    await usersRepo(db).create({ orgId, email: 'e@f.io', name: 'E', role: 'agent', passwordHash: 'h' });
    expect((await usersRepo(db).list(orgId)).length).toBe(1);
  });
});
