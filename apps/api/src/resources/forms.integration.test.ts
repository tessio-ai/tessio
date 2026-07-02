// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { buildTestApp, resetDb, createTestDb, loginAs } from '../testing/harness';
import { orgs, schemas } from '@tessio/db';

const db = createTestDb();
const { app, teardown } = buildTestApp();

const theme = { accent: '#4f46e5', headline: 'Report an issue' };
const def = { sections: [{ id: 's1', title: 'About', order: 0, fields: [{ fieldKey: 'title' }] }] };

async function ctx() {
  const [org] = await db.insert(orgs).values({ name: 'Org', slug: `o-${crypto.randomUUID()}` }).returning();
  const [schema] = await db.insert(schemas).values({
    orgId: org.id, kind: 'ticket', key: `t-${crypto.randomUUID()}`, name: 'Incident', status: 'published',
    definition: { fields: [{ key: 'title', label: 'Title', type: 'text', required: true, order: 0, width: 'full' }] },
  }).returning();
  const admin = await loginAs(app, db, { orgId: org.id, role: 'admin' });
  const agent = await loginAs(app, db, { orgId: org.id, role: 'agent' });
  return { orgId: org.id, schemaId: schema.id, admin, agent };
}

describe('forms admin CRUD', () => {
  beforeEach(async () => { await resetDb(db); });
  afterAll(async () => { await db.$client.end(); await teardown(); });

  it('admin creates, lists, fetches, patches, archives a form', async () => {
    const { schemaId, admin } = await ctx();
    const create = await app.inject({ method: 'POST', url: '/api/v1/forms', headers: { cookie: admin.cookie },
      payload: { key: 'report', name: 'Report an issue', categoryKey: 'IT', targetSchemaId: schemaId, theme, definition: def } });
    expect(create.statusCode).toBe(201);
    const id = create.json().id;

    expect((await app.inject({ method: 'GET', url: '/api/v1/forms', headers: { cookie: admin.cookie } })).json().length).toBe(1);
    expect((await app.inject({ method: 'GET', url: `/api/v1/forms/${id}`, headers: { cookie: admin.cookie } })).json().name).toBe('Report an issue');

    const patch = await app.inject({ method: 'PATCH', url: `/api/v1/forms/${id}`, headers: { cookie: admin.cookie }, payload: { name: 'Report a problem', status: 'published' } });
    expect(patch.json().name).toBe('Report a problem');
    expect(patch.json().status).toBe('published');

    const del = await app.inject({ method: 'DELETE', url: `/api/v1/forms/${id}`, headers: { cookie: admin.cookie } });
    expect(del.statusCode).toBe(200);
    expect(del.json().status).toBe('archived');
  });

  it('forbids an agent from managing forms (403)', async () => {
    const { agent } = await ctx();
    expect((await app.inject({ method: 'GET', url: '/api/v1/forms', headers: { cookie: agent.cookie } })).statusCode).toBe(403);
  });

  it('rejects a duplicate key (409)', async () => {
    const { schemaId, admin } = await ctx();
    const body = { key: 'dup', name: 'A', categoryKey: 'IT', targetSchemaId: schemaId, theme, definition: def };
    await app.inject({ method: 'POST', url: '/api/v1/forms', headers: { cookie: admin.cookie }, payload: body });
    const second = await app.inject({ method: 'POST', url: '/api/v1/forms', headers: { cookie: admin.cookie }, payload: { ...body, name: 'B' } });
    expect(second.statusCode).toBe(409);
  });

  it('rejects a definition with a dangling field (400)', async () => {
    const { schemaId, admin } = await ctx();
    const res = await app.inject({ method: 'POST', url: '/api/v1/forms', headers: { cookie: admin.cookie },
      payload: { key: 'bad', name: 'Bad', categoryKey: 'IT', targetSchemaId: schemaId, theme, definition: { sections: [{ id: 's', title: 'S', order: 0, fields: [{ fieldKey: 'ghost' }] }] } } });
    expect(res.statusCode).toBe(400);
    expect(res.json().detail).toMatch(/ghost/);
  });

  it('rejects a non-ticket / missing target schema (400)', async () => {
    const { admin } = await ctx();
    const res = await app.inject({ method: 'POST', url: '/api/v1/forms', headers: { cookie: admin.cookie },
      payload: { key: 'x', name: 'X', categoryKey: 'IT', targetSchemaId: '00000000-0000-0000-0000-000000000000', theme, definition: def } });
    expect(res.statusCode).toBe(400);
  });
});
