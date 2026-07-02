// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { buildTestApp, resetDb, createTestDb, loginAs } from '../testing/harness';
import { orgs, schemas, formsRepo } from '@tessio/db';

const db = createTestDb();
const { app, teardown } = buildTestApp();

afterAll(async () => { await db.$client.end(); await teardown(); });

async function ctx() {
  const [org] = await db.insert(orgs).values({ name: 'Org', slug: `o-${crypto.randomUUID()}` }).returning();
  const [schema] = await db.insert(schemas).values({
    orgId: org.id, kind: 'ticket', key: `t-${crypto.randomUUID()}`, name: 'Incident', version: 1, status: 'published',
    definition: { fields: [{ key: 'title', label: 'Title', type: 'text', required: true, order: 0, width: 'full' }, { key: 'urgency', label: 'Urgency', type: 'select', required: false, order: 1, width: 'full' }] },
  }).returning();
  const admin = await loginAs(app, db, { orgId: org.id, role: 'admin' });
  const agent = await loginAs(app, db, { orgId: org.id, role: 'agent' });
  return { orgId: org.id, schemaId: schema.id, admin, agent };
}

const fields = (keys: string[]) => keys.map((k, i) => ({ key: k, label: k, type: 'text', required: false, order: i, width: 'full' }));

describe('PATCH /schemas/:id', () => {
  beforeEach(async () => { await resetDb(db); });

  it('admin updates fields and bumps the version', async () => {
    const { schemaId, admin } = await ctx();
    const res = await app.inject({ method: 'PATCH', url: `/api/v1/schemas/${schemaId}`, headers: { cookie: admin.cookie },
      payload: { definition: { fields: fields(['title', 'urgency', 'location']) } } });
    expect(res.statusCode).toBe(200);
    expect(res.json().version).toBe(2);
    expect(res.json().definition.fields.length).toBe(3);
  });

  it('forbids an agent (403)', async () => {
    const { schemaId, agent } = await ctx();
    const res = await app.inject({ method: 'PATCH', url: `/api/v1/schemas/${schemaId}`, headers: { cookie: agent.cookie }, payload: { definition: { fields: fields(['title']) } } });
    expect(res.statusCode).toBe(403);
  });

  it('blocks removing a field referenced by a published form (409)', async () => {
    const { orgId, schemaId, admin } = await ctx();
    await formsRepo(db).create({ orgId, key: 'f', name: 'Uses Urgency', categoryKey: 'IT', targetSchemaId: schemaId,
      theme: { accent: '#000', headline: 'H', layout: 'single', bg: 'plain', font: 'sans', showTess: true }, status: 'published',
      definition: { sections: [{ id: 's', title: 'S', order: 0, fields: [{ fieldKey: 'urgency', width: 'full' }] }] } });
    const res = await app.inject({ method: 'PATCH', url: `/api/v1/schemas/${schemaId}`, headers: { cookie: admin.cookie }, payload: { definition: { fields: fields(['title']) } } });
    expect(res.statusCode).toBe(409);
    expect(res.json().detail).toMatch(/urgency/);
    expect(res.json().detail).toMatch(/Uses Urgency/);
  });
});

describe('POST /schemas', () => {
  it('admin creates a ticket type with a default title field', async () => {
    const [org] = await db.insert(orgs).values({ name: 'Org', slug: `o-${crypto.randomUUID()}` }).returning();
    const admin = await loginAs(app, db, { orgId: org.id, role: 'admin' });
    const res = await app.inject({ method: 'POST', url: '/api/v1/schemas', headers: { cookie: admin.cookie }, payload: { name: 'Onboarding' } });
    expect(res.statusCode).toBe(201);
    expect(res.json().kind).toBe('ticket');
    expect(res.json().definition.fields[0].key).toBe('title');
  });

  it('forbids an agent (403)', async () => {
    const [org] = await db.insert(orgs).values({ name: 'Org', slug: `o-${crypto.randomUUID()}` }).returning();
    const agent = await loginAs(app, db, { orgId: org.id, role: 'agent' });
    const res = await app.inject({ method: 'POST', url: '/api/v1/schemas', headers: { cookie: agent.cookie }, payload: { name: 'X' } });
    expect(res.statusCode).toBe(403);
  });

  it('creates an asset-kind schema', async () => {
    const [org] = await db.insert(orgs).values({ name: 'Org', slug: `o-${crypto.randomUUID()}` }).returning();
    const admin = await loginAs(app, db, { orgId: org.id, role: 'admin' });
    const res = await app.inject({ method: 'POST', url: '/api/v1/schemas', headers: { cookie: admin.cookie }, payload: { name: 'Servers', kind: 'asset' } });
    expect(res.statusCode).toBe(201);
    expect(res.json().kind).toBe('asset');
  });
});
