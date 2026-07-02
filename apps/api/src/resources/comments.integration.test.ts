// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { buildTestApp, resetDb, seedOrgAndSchema, createTestDb, loginAs } from '../testing/harness';

const db = createTestDb();
const { app, teardown } = buildTestApp();

describe('comments sub-resource', () => {
  beforeEach(async () => {
    await resetDb(db);
  });
  afterAll(async () => {
    await db.$client.end();
    await teardown();
  });

  it('adds and lists comments on a ticket', async () => {
    const { orgId, schemaId, schemaVersion } = await seedOrgAndSchema(db, 'ticket');
    const { cookie } = await loginAs(app, db, { orgId, role: 'agent' });
    const headers = { cookie };
    const ticket = (await app.inject({ method: 'POST', url: '/api/v1/tickets', headers, payload: { schemaId, schemaVersion } })).json();

    const add = await app.inject({ method: 'POST', url: `/api/v1/tickets/${ticket.id}/comments`, headers, payload: { body: 'Hello', internal: false } });
    expect(add.statusCode).toBe(201);

    const list = await app.inject({ method: 'GET', url: `/api/v1/tickets/${ticket.id}/comments`, headers });
    expect(list.statusCode).toBe(200);
    const rows = list.json();
    expect(rows).toHaveLength(1);
    expect(rows[0].body).toBe('Hello');
  });
});
