// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { ticketsRepo, csatSettingsRepo, csatResponsesRepo } from '@tessio/db';
import type { TestDb } from '@tessio/db/testing';
import { buildTestApp, createTestDb, resetDb, seedOrgAndSchema, loginAs } from '../testing/harness';

let app: FastifyInstance;
let teardown: () => Promise<void>;
let db: TestDb;

beforeAll(async () => {
  ({ app, teardown } = buildTestApp());
  db = createTestDb();
  await app.ready();
});
afterAll(async () => {
  await teardown();
  await db.$client.end();
});
beforeEach(async () => {
  await resetDb(db);
});

async function seedResolvedTicket(orgId: string, schemaId: string, schemaVersion: number, requesterId: string, status = 'resolved') {
  return ticketsRepo(db).create({ orgId, schemaId, schemaVersion, requesterId, status, data: { title: 'Broken VPN' } });
}

describe('csat settings (admin)', () => {
  it('GET lazily creates a disabled default and PUT round-trips', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    const { cookie } = await loginAs(app, db, { orgId, role: 'admin' });

    const got = await app.inject({ method: 'GET', url: '/api/v1/csat-settings', headers: { cookie } });
    expect(got.statusCode).toBe(200);
    expect(got.json()).toEqual({ enabled: false, question: null });

    const put = await app.inject({
      method: 'PUT', url: '/api/v1/csat-settings', headers: { cookie },
      payload: { enabled: true, question: 'How did we do?' },
    });
    expect(put.statusCode).toBe(200);
    expect(put.json()).toEqual({ enabled: true, question: 'How did we do?' });
  });

  it('is admin-only', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    const { cookie } = await loginAs(app, db, { orgId, role: 'agent' });
    const res = await app.inject({ method: 'GET', url: '/api/v1/csat-settings', headers: { cookie } });
    expect(res.statusCode).toBe(403);
  });
});

describe('portal csat submit', () => {
  it('lets the requester rate their own resolved ticket once', async () => {
    const { orgId, schemaId, schemaVersion } = await seedOrgAndSchema(db, 'ticket');
    await csatSettingsRepo(db).getOrCreate(orgId);
    await csatSettingsRepo(db).update(orgId, { enabled: true });
    const { cookie, userId } = await loginAs(app, db, { orgId, role: 'requester' });
    const ticket = await seedResolvedTicket(orgId, schemaId, schemaVersion, userId);

    const res = await app.inject({
      method: 'POST', url: `/api/v1/portal/tickets/${ticket.id}/csat`, headers: { cookie },
      payload: { rating: 4, comment: 'Quick fix, thanks!' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ ticketId: ticket.id, rating: 4, comment: 'Quick fix, thanks!' });
    expect(res.json().respondedAt).toBeTruthy();

    // second attempt conflicts
    const again = await app.inject({
      method: 'POST', url: `/api/v1/portal/tickets/${ticket.id}/csat`, headers: { cookie },
      payload: { rating: 1 },
    });
    expect(again.statusCode).toBe(409);
  });

  it('fills in a survey the worker already sent instead of inserting a duplicate', async () => {
    const { orgId, schemaId, schemaVersion } = await seedOrgAndSchema(db, 'ticket');
    await csatSettingsRepo(db).getOrCreate(orgId);
    await csatSettingsRepo(db).update(orgId, { enabled: true });
    const { cookie, userId } = await loginAs(app, db, { orgId, role: 'requester' });
    const ticket = await seedResolvedTicket(orgId, schemaId, schemaVersion, userId);
    await csatResponsesRepo(db).createSurvey({ orgId, ticketId: ticket.id, requesterId: userId });

    const res = await app.inject({
      method: 'POST', url: `/api/v1/portal/tickets/${ticket.id}/csat`, headers: { cookie },
      payload: { rating: 5 },
    });
    expect(res.statusCode).toBe(201);
    const row = await csatResponsesRepo(db).getByTicket(orgId, ticket.id);
    expect(row?.rating).toBe(5);
    expect(row?.respondedAt).toBeTruthy();
  });

  it('rejects ratings on open tickets, other users tickets, and out-of-range scores', async () => {
    const { orgId, schemaId, schemaVersion } = await seedOrgAndSchema(db, 'ticket');
    await csatSettingsRepo(db).getOrCreate(orgId);
    await csatSettingsRepo(db).update(orgId, { enabled: true });
    const { cookie, userId } = await loginAs(app, db, { orgId, role: 'requester' });

    const open = await seedResolvedTicket(orgId, schemaId, schemaVersion, userId, 'open');
    const openRes = await app.inject({ method: 'POST', url: `/api/v1/portal/tickets/${open.id}/csat`, headers: { cookie }, payload: { rating: 5 } });
    expect(openRes.statusCode).toBe(400);

    const other = await loginAs(app, db, { orgId, role: 'requester' });
    const notMine = await seedResolvedTicket(orgId, schemaId, schemaVersion, other.userId);
    const notMineRes = await app.inject({ method: 'POST', url: `/api/v1/portal/tickets/${notMine.id}/csat`, headers: { cookie }, payload: { rating: 5 } });
    expect(notMineRes.statusCode).toBe(404);

    const mine = await seedResolvedTicket(orgId, schemaId, schemaVersion, userId);
    const outOfRange = await app.inject({ method: 'POST', url: `/api/v1/portal/tickets/${mine.id}/csat`, headers: { cookie }, payload: { rating: 6 } });
    expect(outOfRange.statusCode).toBe(400);
  });

  it('404s when surveys are disabled for the org', async () => {
    const { orgId, schemaId, schemaVersion } = await seedOrgAndSchema(db, 'ticket');
    const { cookie, userId } = await loginAs(app, db, { orgId, role: 'requester' });
    const ticket = await seedResolvedTicket(orgId, schemaId, schemaVersion, userId);
    const res = await app.inject({ method: 'POST', url: `/api/v1/portal/tickets/${ticket.id}/csat`, headers: { cookie }, payload: { rating: 5 } });
    expect(res.statusCode).toBe(404);
  });

  it('GET /portal/csat returns the caller state and only their responses', async () => {
    const { orgId, schemaId, schemaVersion } = await seedOrgAndSchema(db, 'ticket');
    await csatSettingsRepo(db).getOrCreate(orgId);
    await csatSettingsRepo(db).update(orgId, { enabled: true, question: 'Happy?' });
    const { cookie, userId } = await loginAs(app, db, { orgId, role: 'requester' });
    const other = await loginAs(app, db, { orgId, role: 'requester' });

    const mine = await seedResolvedTicket(orgId, schemaId, schemaVersion, userId);
    const theirs = await seedResolvedTicket(orgId, schemaId, schemaVersion, other.userId);
    await csatResponsesRepo(db).submit({ orgId, ticketId: mine.id, requesterId: userId, rating: 5, comment: null });
    await csatResponsesRepo(db).submit({ orgId, ticketId: theirs.id, requesterId: other.userId, rating: 1, comment: null });

    const res = await app.inject({ method: 'GET', url: '/api/v1/portal/csat', headers: { cookie } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.enabled).toBe(true);
    expect(body.question).toBe('Happy?');
    expect(body.responses).toHaveLength(1);
    expect(body.responses[0]).toMatchObject({ ticketId: mine.id, rating: 5 });
  });
});

describe('staff csat read', () => {
  it('returns the survey for agents and hides the route from requesters', async () => {
    const { orgId, schemaId, schemaVersion } = await seedOrgAndSchema(db, 'ticket');
    const requester = await loginAs(app, db, { orgId, role: 'requester' });
    const ticket = await seedResolvedTicket(orgId, schemaId, schemaVersion, requester.userId);
    await csatResponsesRepo(db).submit({ orgId, ticketId: ticket.id, requesterId: requester.userId, rating: 3, comment: 'ok' });

    const agent = await loginAs(app, db, { orgId, role: 'agent' });
    const res = await app.inject({ method: 'GET', url: `/api/v1/tickets/${ticket.id}/csat`, headers: { cookie: agent.cookie } });
    expect(res.statusCode).toBe(200);
    expect(res.json().survey).toMatchObject({ rating: 3, comment: 'ok' });

    const denied = await app.inject({ method: 'GET', url: `/api/v1/tickets/${ticket.id}/csat`, headers: { cookie: requester.cookie } });
    expect(denied.statusCode).toBe(403);

    // unsurveyed ticket → null
    const empty = await seedResolvedTicket(orgId, schemaId, schemaVersion, requester.userId);
    const nullRes = await app.inject({ method: 'GET', url: `/api/v1/tickets/${empty.id}/csat`, headers: { cookie: agent.cookie } });
    expect(nullRes.json().survey).toBeNull();
  });

  it('does not leak surveys across orgs', async () => {
    const a = await seedOrgAndSchema(db, 'ticket');
    const b = await seedOrgAndSchema(db, 'ticket');
    const reqA = await loginAs(app, db, { orgId: a.orgId, role: 'requester' });
    const ticketA = await seedResolvedTicket(a.orgId, a.schemaId, a.schemaVersion, reqA.userId);
    await csatResponsesRepo(db).submit({ orgId: a.orgId, ticketId: ticketA.id, requesterId: reqA.userId, rating: 5, comment: null });

    const agentB = await loginAs(app, db, { orgId: b.orgId, role: 'agent' });
    const res = await app.inject({ method: 'GET', url: `/api/v1/tickets/${ticketA.id}/csat`, headers: { cookie: agentB.cookie } });
    expect(res.statusCode).toBe(404);
  });
});
