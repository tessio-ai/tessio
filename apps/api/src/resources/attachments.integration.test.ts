// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import FormData from 'form-data';
import { buildTestApp, resetDb, seedOrgAndSchema, createTestDb, loginAs } from '../testing/harness';

const db = createTestDb();
const { app, teardown } = buildTestApp();
let ctxData: { orgId: string; schemaId: string; schemaVersion: number };

async function makeTicket(cookie: string) {
  return (await app.inject({ method: 'POST', url: '/api/v1/tickets', headers: { cookie }, payload: { schemaId: ctxData.schemaId, schemaVersion: ctxData.schemaVersion } })).json();
}
function multipart(content: Buffer, filename: string, contentType: string) {
  const form = new FormData();
  form.append('file', content, { filename, contentType });
  return { payload: form.getBuffer(), headers: form.getHeaders() };
}

describe('attachments endpoints', () => {
  beforeEach(async () => { await resetDb(db); ctxData = await seedOrgAndSchema(db, 'ticket'); });
  afterAll(async () => { await db.$client.end(); await teardown(); });

  it('uploads, lists, downloads, and deletes a ticket attachment', async () => {
    const { cookie } = await loginAs(app, db, { orgId: ctxData.orgId, role: 'agent' });
    const ticket = await makeTicket(cookie);
    const mp = multipart(Buffer.from('hello file'), 'note.txt', 'text/plain');
    const up = await app.inject({ method: 'POST', url: `/api/v1/tickets/${ticket.id}/attachments`, headers: { cookie, ...mp.headers }, payload: mp.payload });
    expect(up.statusCode).toBe(201);
    const att = up.json();
    expect(att.filename).toBe('note.txt');
    const list = await app.inject({ method: 'GET', url: `/api/v1/tickets/${ticket.id}/attachments`, headers: { cookie } });
    expect(list.json()).toHaveLength(1);
    const dl = await app.inject({ method: 'GET', url: `/api/v1/attachments/${att.id}`, headers: { cookie } });
    expect(dl.statusCode).toBe(200);
    expect(dl.body).toBe('hello file');
    expect(dl.headers['content-disposition']).toContain('note.txt');
    const del = await app.inject({ method: 'DELETE', url: `/api/v1/attachments/${att.id}`, headers: { cookie } });
    expect(del.statusCode).toBe(204);
    expect((await app.inject({ method: 'GET', url: `/api/v1/tickets/${ticket.id}/attachments`, headers: { cookie } })).json()).toHaveLength(0);
  });

  it('blocks a disallowed mime type with 415', async () => {
    const { cookie } = await loginAs(app, db, { orgId: ctxData.orgId, role: 'agent' });
    const ticket = await makeTicket(cookie);
    const mp = multipart(Buffer.from('MZ'), 'bad.exe', 'application/x-msdownload');
    const up = await app.inject({ method: 'POST', url: `/api/v1/tickets/${ticket.id}/attachments`, headers: { cookie, ...mp.headers }, payload: mp.payload });
    expect(up.statusCode).toBe(415);
  });

  it('forbids a requester from downloading another requester ticket attachment', async () => {
    const agent = await loginAs(app, db, { orgId: ctxData.orgId, role: 'agent' });
    const ticket = await makeTicket(agent.cookie);
    const mp = multipart(Buffer.from('x'), 'a.txt', 'text/plain');
    const att = (await app.inject({ method: 'POST', url: `/api/v1/tickets/${ticket.id}/attachments`, headers: { cookie: agent.cookie, ...mp.headers }, payload: mp.payload })).json();
    const requester = await loginAs(app, db, { orgId: ctxData.orgId, role: 'requester' });
    const dl = await app.inject({ method: 'GET', url: `/api/v1/attachments/${att.id}`, headers: { cookie: requester.cookie } });
    expect(dl.statusCode).toBe(404);
  });
});
