// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { buildTestApp, resetDb, seedOrgAndSchema, createTestDb, loginAs } from '../testing/harness';
import { listActivity, ticketsRepo, slaSettingsRepo } from '@tessio/db';

const db = createTestDb();
const { app, teardown } = buildTestApp();

async function ctx() {
  const { orgId, schemaId, schemaVersion } = await seedOrgAndSchema(db, 'ticket');
  const { cookie } = await loginAs(app, db, { orgId, role: 'agent' });
  return { headers: { cookie }, orgId, schemaId, schemaVersion };
}

describe('tickets resource', () => {
  beforeEach(async () => {
    await resetDb(db);
  });
  afterAll(async () => {
    await db.$client.end();
    await teardown();
  });

  it('creates a ticket and assigns a number', async () => {
    const { headers, schemaId, schemaVersion } = await ctx();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/tickets',
      headers,
      payload: { schemaId, schemaVersion, status: 'open', data: { title: 'Printer' } },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.number).toBe(1);
    expect(body.status).toBe('open');
  });

  it('gets a ticket by id', async () => {
    const { headers, schemaId, schemaVersion } = await ctx();
    const created = (await app.inject({ method: 'POST', url: '/api/v1/tickets', headers, payload: { schemaId, schemaVersion } })).json();
    const res = await app.inject({ method: 'GET', url: `/api/v1/tickets/${created.id}`, headers });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe(created.id);
  });

  it('returns 404 for a missing ticket', async () => {
    const { headers } = await ctx();
    const res = await app.inject({ method: 'GET', url: '/api/v1/tickets/00000000-0000-0000-0000-000000000000', headers });
    expect(res.statusCode).toBe(404);
  });

  it('patches a ticket', async () => {
    const { headers, schemaId, schemaVersion } = await ctx();
    const created = (await app.inject({ method: 'POST', url: '/api/v1/tickets', headers, payload: { schemaId, schemaVersion, status: 'open' } })).json();
    const res = await app.inject({ method: 'PATCH', url: `/api/v1/tickets/${created.id}`, headers, payload: { status: 'closed' } });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('closed');
  });

  it('stamps resolved_at / closed_at on status transitions and clears them on reopen', async () => {
    const { headers, orgId, schemaId, schemaVersion } = await ctx();
    const created = (await app.inject({ method: 'POST', url: '/api/v1/tickets', headers, payload: { schemaId, schemaVersion, status: 'open' } })).json();

    await app.inject({ method: 'PATCH', url: `/api/v1/tickets/${created.id}`, headers, payload: { status: 'resolved' } });
    let row = await ticketsRepo(db).getById(orgId, created.id);
    expect(row?.resolvedAt).toBeInstanceOf(Date);
    expect(row?.closedAt).toBeNull();

    await app.inject({ method: 'PATCH', url: `/api/v1/tickets/${created.id}`, headers, payload: { status: 'closed' } });
    row = await ticketsRepo(db).getById(orgId, created.id);
    expect(row?.closedAt).toBeInstanceOf(Date);

    await app.inject({ method: 'PATCH', url: `/api/v1/tickets/${created.id}`, headers, payload: { status: 'open' } });
    row = await ticketsRepo(db).getById(orgId, created.id);
    expect(row?.resolvedAt).toBeNull();
    expect(row?.closedAt).toBeNull();
  });

  it('clears the assignee when assigneeId is patched to null', async () => {
    const { headers, schemaId, schemaVersion } = await ctx();
    const created = (await app.inject({ method: 'POST', url: '/api/v1/tickets', headers, payload: { schemaId, schemaVersion } })).json();
    const assignee = (await app.inject({ method: 'GET', url: '/api/v1/users', headers })).json()[0];
    await app.inject({ method: 'PATCH', url: `/api/v1/tickets/${created.id}`, headers, payload: { assigneeId: assignee.id } });
    const cleared = await app.inject({ method: 'PATCH', url: `/api/v1/tickets/${created.id}`, headers, payload: { assigneeId: null } });
    expect(cleared.statusCode).toBe(200);
    expect(cleared.json().assigneeId).toBeNull();
  });

  it('soft-deletes a ticket', async () => {
    const { headers, schemaId, schemaVersion } = await ctx();
    const created = (await app.inject({ method: 'POST', url: '/api/v1/tickets', headers, payload: { schemaId, schemaVersion } })).json();
    const del = await app.inject({ method: 'DELETE', url: `/api/v1/tickets/${created.id}`, headers });
    expect(del.statusCode).toBe(204);
    const get = await app.inject({ method: 'GET', url: `/api/v1/tickets/${created.id}`, headers });
    expect(get.statusCode).toBe(404);
  });

  it('isolates by org (cannot read another org ticket)', async () => {
    const a = await ctx();
    const b = await ctx();
    const created = (await app.inject({ method: 'POST', url: '/api/v1/tickets', headers: a.headers, payload: { schemaId: a.schemaId, schemaVersion: a.schemaVersion } })).json();
    const res = await app.inject({ method: 'GET', url: `/api/v1/tickets/${created.id}`, headers: b.headers });
    expect(res.statusCode).toBe(404);
  });

  it('records a created activity event on create', async () => {
    const { headers, orgId, schemaId, schemaVersion } = await ctx();
    const created = (await app.inject({ method: 'POST', url: '/api/v1/tickets', headers, payload: { schemaId, schemaVersion, status: 'open' } })).json();
    const events = await listActivity(db, orgId, 'ticket', created.id);
    expect(events.map((e) => e.eventType)).toContain('created');
  });

  it('records status / assigned events on patch, and nothing on a no-op', async () => {
    const { headers, orgId, schemaId, schemaVersion } = await ctx();
    const created = (await app.inject({ method: 'POST', url: '/api/v1/tickets', headers, payload: { schemaId, schemaVersion, status: 'open' } })).json();
    const me = (await app.inject({ method: 'GET', url: '/api/v1/users', headers })).json()[0];
    await app.inject({ method: 'PATCH', url: `/api/v1/tickets/${created.id}`, headers, payload: { status: 'resolved', assigneeId: me.id } });
    await app.inject({ method: 'PATCH', url: `/api/v1/tickets/${created.id}`, headers, payload: { status: 'resolved' } }); // no-op
    const events = await listActivity(db, orgId, 'ticket', created.id);
    const kinds = events.map((e) => e.eventType).sort();
    expect(kinds).toEqual(['assigned', 'created', 'status']);
    const status = events.find((e) => e.eventType === 'status')!;
    expect(status.changes).toMatchObject({ from: 'open', to: 'resolved' });
  });

  it('sets slaResponseDueAt + slaResolutionDueAt on create when SLA enabled + matching priority', async () => {
    const { headers, orgId, schemaId, schemaVersion } = await ctx();
    // Enable SLA with high priority targets directly via repo
    await slaSettingsRepo(db).getOrCreate(orgId);
    await slaSettingsRepo(db).update(orgId, {
      enabled: true,
      targets: { high: { responseMins: 60, resolutionMins: 240 } },
    });
    const created = (await app.inject({
      method: 'POST',
      url: '/api/v1/tickets',
      headers,
      payload: { schemaId, schemaVersion, status: 'open', priority: 'high' },
    })).json();
    const row = await ticketsRepo(db).getById(orgId, created.id);
    expect(row?.slaResponseDueAt).toBeInstanceOf(Date);
    expect(row?.slaResolutionDueAt).toBeInstanceOf(Date);
    // Resolution due should be 4h after creation (240 min)
    const resolutionDiff = (row!.slaResolutionDueAt as Date).getTime() - (row!.createdAt as Date).getTime();
    expect(resolutionDiff).toBeGreaterThanOrEqual(239 * 60_000);
    expect(resolutionDiff).toBeLessThanOrEqual(241 * 60_000);
  });

  it('does not set SLA targets when priority has no matching target', async () => {
    const { headers, orgId, schemaId, schemaVersion } = await ctx();
    await slaSettingsRepo(db).getOrCreate(orgId);
    await slaSettingsRepo(db).update(orgId, {
      enabled: true,
      targets: { high: { responseMins: 60, resolutionMins: 240 } },
    });
    const created = (await app.inject({
      method: 'POST',
      url: '/api/v1/tickets',
      headers,
      payload: { schemaId, schemaVersion, status: 'open', priority: 'low' },
    })).json();
    const row = await ticketsRepo(db).getById(orgId, created.id);
    expect(row?.slaResponseDueAt).toBeNull();
    expect(row?.slaResolutionDueAt).toBeNull();
  });

  it('recomputes SLA targets when priority is updated', async () => {
    const { headers, orgId, schemaId, schemaVersion } = await ctx();
    await slaSettingsRepo(db).getOrCreate(orgId);
    await slaSettingsRepo(db).update(orgId, {
      enabled: true,
      targets: {
        low: { responseMins: 480, resolutionMins: 2880 },
        high: { responseMins: 60, resolutionMins: 240 },
      },
    });
    // Create with low priority (480 min response)
    const created = (await app.inject({
      method: 'POST',
      url: '/api/v1/tickets',
      headers,
      payload: { schemaId, schemaVersion, status: 'open', priority: 'low' },
    })).json();
    // Change to high priority (60 min response)
    await app.inject({
      method: 'PATCH',
      url: `/api/v1/tickets/${created.id}`,
      headers,
      payload: { priority: 'high' },
    });
    const row = await ticketsRepo(db).getById(orgId, created.id);
    const responseDiff = (row!.slaResponseDueAt as Date).getTime() - (row!.createdAt as Date).getTime();
    expect(responseDiff).toBeGreaterThanOrEqual(59 * 60_000);
    expect(responseDiff).toBeLessThanOrEqual(61 * 60_000);
  });

  it('sets firstRespondedAt when a staff (agent) adds a public comment', async () => {
    const { headers, orgId, schemaId, schemaVersion } = await ctx();
    const created = (await app.inject({
      method: 'POST',
      url: '/api/v1/tickets',
      headers,
      payload: { schemaId, schemaVersion, status: 'open' },
    })).json();
    // Verify not set yet
    let row = await ticketsRepo(db).getById(orgId, created.id);
    expect(row?.firstRespondedAt).toBeNull();
    // Post a public comment as agent
    await app.inject({
      method: 'POST',
      url: `/api/v1/tickets/${created.id}/comments`,
      headers,
      payload: { body: 'First response', internal: false },
    });
    row = await ticketsRepo(db).getById(orgId, created.id);
    expect(row?.firstRespondedAt).toBeInstanceOf(Date);
  });

  it('does not set firstRespondedAt for an internal comment', async () => {
    const { headers, orgId, schemaId, schemaVersion } = await ctx();
    const created = (await app.inject({
      method: 'POST',
      url: '/api/v1/tickets',
      headers,
      payload: { schemaId, schemaVersion, status: 'open' },
    })).json();
    await app.inject({
      method: 'POST',
      url: `/api/v1/tickets/${created.id}/comments`,
      headers,
      payload: { body: 'Internal note', internal: true },
    });
    const row = await ticketsRepo(db).getById(orgId, created.id);
    expect(row?.firstRespondedAt).toBeNull();
  });

  it('creates a subtask and lists it under its parent', async () => {
    const { headers, schemaId, schemaVersion } = await ctx();
    const parent = (await app.inject({ method: 'POST', url: '/api/v1/tickets', headers, payload: { schemaId, schemaVersion, data: { title: 'Onboard new hire' } } })).json();
    const child = (await app.inject({
      method: 'POST',
      url: '/api/v1/tickets',
      headers,
      payload: { schemaId, schemaVersion, status: 'open', parentId: parent.id, data: { title: 'Provision laptop' } },
    })).json();
    expect(child.parentId).toBe(parent.id);

    const res = await app.inject({ method: 'GET', url: `/api/v1/tickets/${parent.id}/subtasks`, headers });
    expect(res.statusCode).toBe(200);
    const subtasks = res.json();
    expect(subtasks).toHaveLength(1);
    expect(subtasks[0].id).toBe(child.id);
  });

  it('returns 404 listing subtasks of a missing ticket', async () => {
    const { headers } = await ctx();
    const res = await app.inject({ method: 'GET', url: '/api/v1/tickets/00000000-0000-0000-0000-000000000000/subtasks', headers });
    expect(res.statusCode).toBe(404);
  });

  it('re-parents a ticket via PATCH and records a parent activity event', async () => {
    const { headers, orgId, schemaId, schemaVersion } = await ctx();
    const parent = (await app.inject({ method: 'POST', url: '/api/v1/tickets', headers, payload: { schemaId, schemaVersion } })).json();
    const child = (await app.inject({ method: 'POST', url: '/api/v1/tickets', headers, payload: { schemaId, schemaVersion } })).json();

    const patched = await app.inject({ method: 'PATCH', url: `/api/v1/tickets/${child.id}`, headers, payload: { parentId: parent.id } });
    expect(patched.statusCode).toBe(200);
    expect(patched.json().parentId).toBe(parent.id);

    const events = await listActivity(db, orgId, 'ticket', child.id);
    expect(events.some((e) => e.eventType === 'parent')).toBe(true);

    // Detaching sends parentId: null.
    const detached = await app.inject({ method: 'PATCH', url: `/api/v1/tickets/${child.id}`, headers, payload: { parentId: null } });
    expect(detached.statusCode).toBe(200);
    expect(detached.json().parentId).toBeNull();
  });

  it('rejects making a ticket its own parent', async () => {
    const { headers, schemaId, schemaVersion } = await ctx();
    const t = (await app.inject({ method: 'POST', url: '/api/v1/tickets', headers, payload: { schemaId, schemaVersion } })).json();
    const res = await app.inject({ method: 'PATCH', url: `/api/v1/tickets/${t.id}`, headers, payload: { parentId: t.id } });
    expect(res.statusCode).toBe(400);
  });

  it('forbids requesters from listing subtasks', async () => {
    const { headers, schemaId, schemaVersion, orgId } = await ctx();
    const parent = (await app.inject({ method: 'POST', url: '/api/v1/tickets', headers, payload: { schemaId, schemaVersion } })).json();
    const { cookie } = await loginAs(app, db, { orgId, role: 'requester' });
    const res = await app.inject({ method: 'GET', url: `/api/v1/tickets/${parent.id}/subtasks`, headers: { cookie } });
    expect(res.statusCode).toBe(403);
  });
});
