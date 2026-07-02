// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { buildTestApp, resetDb, seedOrgAndSchema, createTestDb, loginAs } from '../testing/harness';

const db = createTestDb();
const { app, teardown } = buildTestApp();

async function makeTicket(headers: Record<string, string>, schemaId: string, schemaVersion: number) {
  return (await app.inject({ method: 'POST', url: '/api/v1/tickets', headers, payload: { schemaId, schemaVersion } })).json();
}

describe('links sub-resource', () => {
  beforeEach(async () => {
    await resetDb(db);
  });
  afterAll(async () => {
    await db.$client.end();
    await teardown();
  });

  it('creates, lists, and traverses links', async () => {
    const { orgId, schemaId, schemaVersion } = await seedOrgAndSchema(db, 'ticket');
    const { cookie } = await loginAs(app, db, { orgId, role: 'agent' });
    const headers = { cookie };
    const a = await makeTicket(headers, schemaId, schemaVersion);
    const b = await makeTicket(headers, schemaId, schemaVersion);

    const create = await app.inject({
      method: 'POST',
      url: `/api/v1/tickets/${a.id}/links`,
      headers,
      payload: { toType: 'ticket', toId: b.id, relationshipType: 'depends_on' },
    });
    expect(create.statusCode).toBe(201);

    const list = await app.inject({ method: 'GET', url: `/api/v1/tickets/${a.id}/links`, headers });
    expect(list.json()).toHaveLength(1);

    const traverse = await app.inject({
      method: 'GET',
      url: `/api/v1/tickets/${a.id}/links/traverse?relationshipType=depends_on&maxDepth=5`,
      headers,
    });
    expect(traverse.statusCode).toBe(200);
    expect(traverse.json().map((n: { toId: string }) => n.toId)).toContain(b.id);
  });
});
