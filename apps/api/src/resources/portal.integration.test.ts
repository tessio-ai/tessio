// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { buildTestApp, resetDb, createTestDb, loginAs } from '../testing/harness';
import { orgs, schemas, formsRepo } from '@tessio/db';

const db = createTestDb();
const { app, teardown } = buildTestApp();

async function ctx() {
  const [org] = await db.insert(orgs).values({ name: 'Org', slug: `o-${crypto.randomUUID()}` }).returning();
  const [schema] = await db.insert(schemas).values({
    orgId: org.id, kind: 'ticket', key: `t-${crypto.randomUUID()}`, name: 'Incident', status: 'published',
    definition: { fields: [
      { key: 'title', label: 'Title', type: 'text', required: true, order: 0, width: 'full' },
      { key: 'urgency', label: 'Urgency', type: 'select', required: false, order: 1, width: 'full', config: { options: ['Low', 'High'] } },
    ] },
  }).returning();
  await formsRepo(db).create({ orgId: org.id, key: 'report', name: 'Report an issue', categoryKey: 'IT', targetSchemaId: schema.id,
    theme: { accent: '#4f46e5', layout: 'single', bg: 'plain', font: 'sans', showTess: true, headline: 'Report an issue' }, status: 'published',
    definition: { sections: [{ id: 's1', title: 'About', order: 0, fields: [{ fieldKey: 'title', width: 'full', placeholder: 'Summary' }, { fieldKey: 'urgency', width: 'half', requiredAtIntake: true }] }] } });
  await formsRepo(db).create({ orgId: org.id, key: 'draft1', name: 'Draft', categoryKey: 'IT', targetSchemaId: schema.id,
    theme: { accent: '#000', layout: 'single', bg: 'plain', font: 'sans', showTess: true, headline: 'D' }, status: 'draft', definition: { sections: [] } });
  const requester = await loginAs(app, db, { orgId: org.id, role: 'requester' });
  return { orgId: org.id, requester };
}

afterAll(async () => { await db.$client.end(); await teardown(); });

describe('public /portal reads', () => {
  beforeEach(async () => { await resetDb(db); });

  it('a requester reads settings and only published forms', async () => {
    const { requester } = await ctx();
    const settings = await app.inject({ method: 'GET', url: '/api/v1/portal/settings', headers: { cookie: requester.cookie } });
    expect(settings.statusCode).toBe(200);
    expect(settings.json().heroHeadline).toBe('How can we help?');

    const list = await app.inject({ method: 'GET', url: '/api/v1/portal/forms', headers: { cookie: requester.cookie } });
    expect(list.statusCode).toBe(200);
    expect(list.json().map((f: { key: string }) => f.key)).toEqual(['report']);
  });

  it('resolves form fields against the target schema', async () => {
    const { requester } = await ctx();
    const res = await app.inject({ method: 'GET', url: '/api/v1/portal/forms/report', headers: { cookie: requester.cookie } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    const fields = body.sections[0].fields;
    const title = fields.find((f: { key: string }) => f.key === 'title');
    const urgency = fields.find((f: { key: string }) => f.key === 'urgency');
    expect(title.type).toBe('text');
    expect(title.placeholder).toBe('Summary');
    expect(title.required).toBe(true);
    expect(urgency.required).toBe(true);
    expect(urgency.config.options).toEqual(['Low', 'High']);
  });

  it('404 for a draft form by key', async () => {
    const { requester } = await ctx();
    expect((await app.inject({ method: 'GET', url: '/api/v1/portal/forms/draft1', headers: { cookie: requester.cookie } })).statusCode).toBe(404);
  });
});

describe('POST /portal/forms/:key/submit', () => {
  beforeEach(async () => { await resetDb(db); });

  it('creates a ticket from valid answers, owned by the requester', async () => {
    const { requester } = await ctx();
    const res = await app.inject({ method: 'POST', url: '/api/v1/portal/forms/report/submit', headers: { cookie: requester.cookie },
      payload: { values: { title: 'Printer offline', urgency: 'High' } } });
    expect(res.statusCode).toBe(201);
    expect(typeof res.json().number).toBe('number');
    const mine = await app.inject({ method: 'GET', url: '/api/v1/tickets', headers: { cookie: requester.cookie } });
    const row = mine.json().rows.find((t: { id: string }) => t.id === res.json().id);
    expect(row).toBeTruthy();
    expect(row.requesterId).toBe(requester.userId);
    expect(row.data).toMatchObject({ title: 'Printer offline', urgency: 'High' });
    expect(row.formId).toBeTruthy();
  });

  it('ignores a requesterId in the body (forces self)', async () => {
    const { requester } = await ctx();
    const res = await app.inject({ method: 'POST', url: '/api/v1/portal/forms/report/submit', headers: { cookie: requester.cookie },
      payload: { values: { title: 'x', urgency: 'Low' }, requesterId: '00000000-0000-0000-0000-000000000000' } });
    expect(res.statusCode).toBe(201);
    const mine = await app.inject({ method: 'GET', url: '/api/v1/tickets', headers: { cookie: requester.cookie } });
    expect(mine.json().rows.find((t: { id: string }) => t.id === res.json().id).requesterId).toBe(requester.userId);
  });

  it('400 when a required-at-intake field is missing', async () => {
    const { requester } = await ctx();
    const res = await app.inject({ method: 'POST', url: '/api/v1/portal/forms/report/submit', headers: { cookie: requester.cookie },
      payload: { values: { title: 'only title' } } });
    expect(res.statusCode).toBe(400);
    expect(res.json().detail).toMatch(/urgency/);
  });

  it('drops unknown value keys (only exposed fields are stored)', async () => {
    const { requester } = await ctx();
    const res = await app.inject({ method: 'POST', url: '/api/v1/portal/forms/report/submit', headers: { cookie: requester.cookie },
      payload: { values: { title: 't', urgency: 'Low', injected: 'nope' } } });
    expect(res.statusCode).toBe(201);
    const mine = await app.inject({ method: 'GET', url: '/api/v1/tickets', headers: { cookie: requester.cookie } });
    expect(mine.json().rows.find((t: { id: string }) => t.id === res.json().id).data.injected).toBeUndefined();
  });

  it('404 for a non-published form', async () => {
    const { requester } = await ctx();
    const res = await app.inject({ method: 'POST', url: '/api/v1/portal/forms/__nope__/submit', headers: { cookie: requester.cookie }, payload: { values: {} } });
    expect(res.statusCode).toBe(404);
  });
});
