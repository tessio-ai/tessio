// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { createTestDb, resetDb } from './testing/test-db';
import { seedAdmin, seedAssetSchema, seedTicketSchema, seedTeams, seedKbSchema } from './seed';
import { verifyPassword } from './auth/password';
import { schemasRepo, teamsRepo } from './repositories';

const db = createTestDb();

afterAll(async () => { await db.$client.end(); });

describe('seedAdmin', () => {
  beforeEach(async () => { await resetDb(db); });

  it('creates the default org and an admin with a usable password', async () => {
    const user = await seedAdmin(db, { email: 'admin@acme.io', password: 'secret123' });
    expect(user.role).toBe('admin');
    expect(await verifyPassword('secret123', user.passwordHash)).toBe(true);
  });

  it('is idempotent — calling twice returns the same admin', async () => {
    const a = await seedAdmin(db, { email: 'admin@acme.io', password: 'secret123' });
    const b = await seedAdmin(db, { email: 'admin@acme.io', password: 'different' });
    expect(b.id).toBe(a.id);
  });
});

describe('seedAssetSchema', () => {
  beforeEach(async () => { await resetDb(db); });

  it('seeds a published Hardware Asset schema idempotently', async () => {
    const user = await seedAdmin(db, { email: 'admin@acme.io', password: 'secret123' });
    await seedAssetSchema(db, user.orgId);
    await seedAssetSchema(db, user.orgId); // idempotent
    const assets = await schemasRepo(db).list(user.orgId, { kind: 'asset' });
    expect(assets).toHaveLength(1);
    expect(assets[0].name).toBe('Hardware Asset');
    expect(assets[0].definition.fields.map((f) => f.key)).toEqual(['name', 'category', 'manufacturer', 'model', 'notes']);
  });
});

describe('seedTicketSchema', () => {
  beforeEach(async () => { await resetDb(db); });

  it('seeds the four standard ticket types, published, idempotently', async () => {
    const user = await seedAdmin(db, { email: 'admin@acme.io', password: 'secret123' });
    await seedTicketSchema(db, user.orgId);
    await seedTicketSchema(db, user.orgId); // idempotent
    const types = await schemasRepo(db).list(user.orgId, { kind: 'ticket' });
    expect(types.map((t) => t.key).sort()).toEqual(['change', 'incident', 'problem', 'service_request']);
    expect(types.every((t) => t.status === 'published')).toBe(true);
    const incident = types.find((t) => t.key === 'incident')!;
    expect(incident.name).toBe('Incident');
    expect(incident.definition.fields.map((f) => f.key)).toContain('title');
  });

  it('adds only missing types when some already exist (per-key idempotency)', async () => {
    const user = await seedAdmin(db, { email: 'admin2@acme.io', password: 'secret123' });
    await schemasRepo(db).create({ orgId: user.orgId, kind: 'ticket', key: 'incident', name: 'Incident', status: 'published', definition: { fields: [] } });
    await seedTicketSchema(db, user.orgId);
    const types = await schemasRepo(db).list(user.orgId, { kind: 'ticket' });
    expect(types.map((t) => t.key).sort()).toEqual(['change', 'incident', 'problem', 'service_request']);
  });
});

describe('seedTeams', () => {
  beforeEach(async () => { await resetDb(db); });
  it('seeds the default teams idempotently', async () => {
    const user = await seedAdmin(db, { email: 'admin@acme.io', password: 'secret123' });
    await seedTeams(db, user.orgId);
    await seedTeams(db, user.orgId); // idempotent
    const teams = await teamsRepo(db).list(user.orgId);
    expect(teams.map((t) => t.name).sort()).toEqual(['Facilities', 'IT Ops', 'Network', 'Onboarding', 'Security']);
  });
});

describe('seedKbSchema', () => {
  beforeEach(async () => { await resetDb(db); });
  it('seeds a published Article kb_article schema idempotently', async () => {
    const user = await seedAdmin(db, { email: 'admin@acme.io', password: 'secret123' });
    await seedKbSchema(db, user.orgId);
    await seedKbSchema(db, user.orgId);
    const kb = await schemasRepo(db).list(user.orgId, { kind: 'kb_article' });
    expect(kb).toHaveLength(1);
    expect(kb[0].name).toBe('Article');
    expect(kb[0].definition.fields.map((f) => f.key)).toEqual(['body', 'category', 'tags']);
  });
});
