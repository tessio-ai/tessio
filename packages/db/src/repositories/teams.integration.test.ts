// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { createTestDb, resetDb, seedOrgAndSchema } from '../testing/test-db';
import { teamsRepo } from './teams';
import { ticketsRepo } from './tickets';

const db = createTestDb();
const repo = teamsRepo(db);

describe('teamsRepo', () => {
  beforeEach(async () => { await resetDb(db); });
  afterAll(async () => { await db.$client.end(); });

  it('creates and lists teams scoped to the org', async () => {
    const a = await seedOrgAndSchema(db, 'ticket');
    const b = await seedOrgAndSchema(db, 'ticket');
    await repo.create({ orgId: a.orgId, name: 'Network' });
    await repo.create({ orgId: b.orgId, name: 'Security' });
    const aTeams = await repo.list(a.orgId);
    expect(aTeams.map((t) => t.name)).toEqual(['Network']);
  });

  it('renames a team', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    const t = await repo.create({ orgId, name: 'Net' });
    const renamed = await repo.rename(orgId, t.id, 'Network');
    expect(renamed.name).toBe('Network');
  });

  it('removing a team nulls referencing tickets then deletes the team', async () => {
    const { orgId, schemaId, schemaVersion } = await seedOrgAndSchema(db, 'ticket');
    const team = await repo.create({ orgId, name: 'IT Ops' });
    const ticket = await ticketsRepo(db).create({ orgId, schemaId, schemaVersion, teamId: team.id });
    await repo.remove(orgId, team.id);
    expect(await repo.findById(orgId, team.id)).toBeUndefined();
    const after = await ticketsRepo(db).getById(orgId, ticket.id);
    expect(after?.teamId).toBeNull();
  });

  it('enforces unique name per org', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    await repo.create({ orgId, name: 'Dup' });
    await expect(repo.create({ orgId, name: 'Dup' })).rejects.toThrow();
  });
});
