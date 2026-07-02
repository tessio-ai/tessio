// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { buildTestApp, resetDb, seedOrgAndSchema, createTestDb, loginAs } from '../testing/harness';

const db = createTestDb();
const { app, teardown } = buildTestApp();

describe('comment visibility (requester)', () => {
  beforeEach(async () => { await resetDb(db); });
  afterAll(async () => { await db.$client.end(); await teardown(); });

  it('hides internal comments from the requester and forces their comments public', async () => {
    const { orgId, schemaId, schemaVersion } = await seedOrgAndSchema(db, 'ticket');
    const requester = await loginAs(app, db, { orgId, role: 'requester' });
    const agent = await loginAs(app, db, { orgId, role: 'agent' });

    // requester creates a ticket (owned by them)
    const ticket = (await app.inject({ method: 'POST', url: '/api/v1/tickets', headers: { cookie: requester.cookie }, payload: { schemaId, schemaVersion, data: {} } })).json();

    // agent posts an internal note
    await app.inject({ method: 'POST', url: `/api/v1/tickets/${ticket.id}/comments`, headers: { cookie: agent.cookie }, payload: { body: 'internal note', internal: true } });
    // agent posts a public reply
    await app.inject({ method: 'POST', url: `/api/v1/tickets/${ticket.id}/comments`, headers: { cookie: agent.cookie }, payload: { body: 'public reply' } });
    // requester tries to post an internal comment
    const reqComment = await app.inject({ method: 'POST', url: `/api/v1/tickets/${ticket.id}/comments`, headers: { cookie: requester.cookie }, payload: { body: 'my reply', internal: true } });
    expect(reqComment.json().internal).toBe(false); // forced public

    // requester sees only the public comments
    const seen = await app.inject({ method: 'GET', url: `/api/v1/tickets/${ticket.id}/comments`, headers: { cookie: requester.cookie } });
    const bodies = seen.json().map((c: { body: string }) => c.body).sort();
    expect(bodies).toEqual(['my reply', 'public reply']);

    // agent still sees everything
    const agentSeen = await app.inject({ method: 'GET', url: `/api/v1/tickets/${ticket.id}/comments`, headers: { cookie: agent.cookie } });
    expect(agentSeen.json().length).toBe(3);
  });
});
