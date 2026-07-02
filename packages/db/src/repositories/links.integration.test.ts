// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { createTestDb, resetDb, seedOrgAndSchema } from '../testing/test-db';
import { ticketsRepo } from './tickets';
import { linksRepo } from './links';

const db = createTestDb();

async function makeTicket(orgId: string, schemaId: string, schemaVersion: number) {
  return ticketsRepo(db).create({ orgId, schemaId, schemaVersion });
}

describe('linksRepo', () => {
  beforeEach(async () => {
    await resetDb(db);
  });
  afterAll(async () => {
    await db.$client.end();
  });

  it('creates and lists outgoing links for a record', async () => {
    const { orgId, schemaId, schemaVersion } = await seedOrgAndSchema(db, 'ticket');
    const a = await makeTicket(orgId, schemaId, schemaVersion);
    const b = await makeTicket(orgId, schemaId, schemaVersion);
    await linksRepo(db).createLink(orgId, {
      fromType: 'ticket',
      fromId: a.id,
      toType: 'ticket',
      toId: b.id,
      relationshipType: 'depends_on',
    });
    const links = await linksRepo(db).listLinks(orgId, 'ticket', a.id);
    expect(links).toHaveLength(1);
    expect(links[0].toId).toBe(b.id);
  });

  it('deletes a link', async () => {
    const { orgId, schemaId, schemaVersion } = await seedOrgAndSchema(db, 'ticket');
    const a = await makeTicket(orgId, schemaId, schemaVersion);
    const b = await makeTicket(orgId, schemaId, schemaVersion);
    const link = await linksRepo(db).createLink(orgId, {
      fromType: 'ticket',
      fromId: a.id,
      toType: 'ticket',
      toId: b.id,
      relationshipType: 'linked_to',
    });
    await linksRepo(db).deleteLink(orgId, link.id);
    expect(await linksRepo(db).listLinks(orgId, 'ticket', a.id)).toHaveLength(0);
  });

  it('traverses a multi-hop dependency chain within maxDepth', async () => {
    const { orgId, schemaId, schemaVersion } = await seedOrgAndSchema(db, 'ticket');
    const a = await makeTicket(orgId, schemaId, schemaVersion);
    const b = await makeTicket(orgId, schemaId, schemaVersion);
    const c = await makeTicket(orgId, schemaId, schemaVersion);
    const repo = linksRepo(db);
    await repo.createLink(orgId, { fromType: 'ticket', fromId: a.id, toType: 'ticket', toId: b.id, relationshipType: 'depends_on' });
    await repo.createLink(orgId, { fromType: 'ticket', fromId: b.id, toType: 'ticket', toId: c.id, relationshipType: 'depends_on' });

    const reachable = await repo.traverse(orgId, 'ticket', a.id, 'depends_on', 10);
    const ids = reachable.map((r) => r.toId).sort();
    expect(ids).toEqual([b.id, c.id].sort());
  });

  it('terminates on a cycle thanks to the depth limit', async () => {
    const { orgId, schemaId, schemaVersion } = await seedOrgAndSchema(db, 'ticket');
    const a = await makeTicket(orgId, schemaId, schemaVersion);
    const b = await makeTicket(orgId, schemaId, schemaVersion);
    const repo = linksRepo(db);
    await repo.createLink(orgId, { fromType: 'ticket', fromId: a.id, toType: 'ticket', toId: b.id, relationshipType: 'depends_on' });
    await repo.createLink(orgId, { fromType: 'ticket', fromId: b.id, toType: 'ticket', toId: a.id, relationshipType: 'depends_on' });
    const reachable = await repo.traverse(orgId, 'ticket', a.id, 'depends_on', 5);
    // a→b→a→b… capped at depth 5; must return without hanging.
    expect(reachable.length).toBeGreaterThan(0);
  });
});
