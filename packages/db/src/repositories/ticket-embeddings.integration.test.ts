// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { createTestDb, resetDb, seedOrgAndSchema } from '../testing/test-db';
import { ticketsRepo } from './tickets';
import { ticketEmbeddingsRepo } from './ticket-embeddings';

const db = createTestDb();
const repo = ticketEmbeddingsRepo(db);

// Deterministic unit vectors so cosine distance is predictable.
function unit(i: number): number[] {
  const v = new Array(1536).fill(0);
  v[i] = 1;
  return v;
}

afterAll(async () => { await db.$client.end(); });

describe('ticketEmbeddingsRepo', () => {
  beforeEach(async () => { await resetDb(db); });

  async function mkTicket(orgId: string, schemaId: string, schemaVersion: number, title: string) {
    return ticketsRepo(db).create({ orgId, schemaId, schemaVersion, data: { title, description: '' } } as never);
  }

  it('upserts and reads back an embedding', async () => {
    const { orgId, schemaId, schemaVersion } = await seedOrgAndSchema(db, 'ticket');
    const t = await mkTicket(orgId, schemaId, schemaVersion, 'A');
    await repo.upsert({ ticketId: t.id, orgId, embedding: unit(0), contentHash: 'h1', model: 'm' });
    const got = await repo.get(t.id);
    expect(got?.contentHash).toBe('h1');
    expect(got?.embedding.length).toBe(1536);
  });

  it('findSimilar returns the nearest ticket, excludes self, and orders by similarity', async () => {
    const { orgId, schemaId, schemaVersion } = await seedOrgAndSchema(db, 'ticket');
    const src = await mkTicket(orgId, schemaId, schemaVersion, 'src');
    const near = await mkTicket(orgId, schemaId, schemaVersion, 'near');
    const far = await mkTicket(orgId, schemaId, schemaVersion, 'far');
    await repo.upsert({ ticketId: src.id, orgId, embedding: unit(0), contentHash: 'a', model: 'm' });
    await repo.upsert({ ticketId: near.id, orgId, embedding: unit(0), contentHash: 'b', model: 'm' }); // identical → score 1
    await repo.upsert({ ticketId: far.id, orgId, embedding: unit(1), contentHash: 'c', model: 'm' });   // orthogonal → score 0, filtered out
    const out = await repo.findSimilar(orgId, src.id, { limit: 5 });
    expect(out.map((r) => r.id)).toContain(near.id);
    expect(out.map((r) => r.id)).not.toContain(src.id);
    expect(out[0].id).toBe(near.id);
    expect(out[0].score).toBeGreaterThan(0.99);
  });

  it('isolates by org', async () => {
    const a = await seedOrgAndSchema(db, 'ticket');
    const b = await seedOrgAndSchema(db, 'ticket');
    const ta = await mkTicket(a.orgId, a.schemaId, a.schemaVersion, 'a');
    const tb = await mkTicket(b.orgId, b.schemaId, b.schemaVersion, 'b');
    await repo.upsert({ ticketId: ta.id, orgId: a.orgId, embedding: unit(0), contentHash: 'a', model: 'm' });
    await repo.upsert({ ticketId: tb.id, orgId: b.orgId, embedding: unit(0), contentHash: 'b', model: 'm' });
    const out = await repo.findSimilar(a.orgId, ta.id, {});
    expect(out.map((r) => r.id)).not.toContain(tb.id);
  });

  it('returns [] when the source ticket has no embedding', async () => {
    const { orgId, schemaId, schemaVersion } = await seedOrgAndSchema(db, 'ticket');
    const t = await mkTicket(orgId, schemaId, schemaVersion, 'x');
    expect(await repo.findSimilar(orgId, t.id, {})).toEqual([]);
  });
});
