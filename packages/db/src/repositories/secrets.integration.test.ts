// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { createTestDb, resetDb } from '../testing/test-db';
import { orgs } from '../schema';
import { secretsRepo } from './secrets';

const db = createTestDb();
const repo = secretsRepo(db);

afterAll(async () => { await db.$client.end(); });

describe('secretsRepo', () => {
  beforeEach(async () => { await resetDb(db); });

  it('creates, list returns row without valueCiphertext, listCiphertexts returns ciphertext', async () => {
    const [org] = await db.insert(orgs).values({ name: 'Org', slug: `o-${crypto.randomUUID()}` }).returning();
    await repo.create({ orgId: org.id, name: 'stripe_key', valueCiphertext: 'ct-stripe', hint: '9999' });

    const list = await repo.list(org.id);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ name: 'stripe_key', hint: '9999' });
    expect(list[0]).not.toHaveProperty('valueCiphertext');

    const ciphertexts = await repo.listCiphertexts(org.id);
    expect(ciphertexts).toEqual([{ name: 'stripe_key', valueCiphertext: 'ct-stripe' }]);
  });

  it('updateValue replaces hint and ciphertext', async () => {
    const [org] = await db.insert(orgs).values({ name: 'Org', slug: `o-${crypto.randomUUID()}` }).returning();
    await repo.create({ orgId: org.id, name: 'k', valueCiphertext: 'ct-a', hint: 'a' });
    await repo.updateValue(org.id, 'k', 'ct-bbbb', 'bbbb');

    const ciphertexts = await repo.listCiphertexts(org.id);
    expect(ciphertexts).toEqual([{ name: 'k', valueCiphertext: 'ct-bbbb' }]);

    const list = await repo.list(org.id);
    expect(list[0]).toMatchObject({ name: 'k', hint: 'bbbb' });
  });

  it('org isolation: data for org A is not visible to org B', async () => {
    const [orgA] = await db.insert(orgs).values({ name: 'OrgA', slug: `oa-${crypto.randomUUID()}` }).returning();
    const [orgB] = await db.insert(orgs).values({ name: 'OrgB', slug: `ob-${crypto.randomUUID()}` }).returning();
    await repo.create({ orgId: orgA.id, name: 'stripe_key', valueCiphertext: 'ct-stripe', hint: '9999' });

    expect(await repo.list(orgB.id)).toEqual([]);
    expect(await repo.listCiphertexts(orgB.id)).toEqual([]);
  });

  it('remove deletes the secret', async () => {
    const [org] = await db.insert(orgs).values({ name: 'Org', slug: `o-${crypto.randomUUID()}` }).returning();
    await repo.create({ orgId: org.id, name: 'to_delete', valueCiphertext: 'ct-del', hint: 'del' });
    await repo.remove(org.id, 'to_delete');

    expect(await repo.list(org.id)).toEqual([]);
  });
});
