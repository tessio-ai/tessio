// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { buildTestApp, resetDb, createTestDb, loginAs, seedOrgAndSchema } from '../testing/harness';
import { ticketsRepo, orgs, teams, teamSchemas, teamMembers, schemas } from '@tessio/db';
import type { ReportDefinition } from '@tessio/shared';

const db = createTestDb();
const { app, teardown } = buildTestApp();

afterAll(async () => {
  await db.$client.end();
  await teardown();
});

/** Seed an org and return an admin + agent + requester cookie. */
async function staffOrg() {
  const { orgId, schemaId, schemaVersion } = await seedOrgAndSchema(db, 'ticket');
  const admin = await loginAs(app, db, { orgId, role: 'admin' });
  const agent = await loginAs(app, db, { orgId, role: 'agent' });
  const requester = await loginAs(app, db, { orgId, role: 'requester' });
  return { orgId, schemaId, schemaVersion, admin, agent, requester };
}

const validDef: ReportDefinition = {
  source: 'tickets',
  measure: { id: 'count' },
  visualization: 'table',
};

describe('reports routes', () => {
  beforeEach(async () => {
    await resetDb(db);
  });

  it('CRUD: create → list → get → patch → delete (as admin)', async () => {
    const { admin } = await staffOrg();

    // create
    const post = await app.inject({
      method: 'POST',
      url: '/api/v1/reports',
      headers: { cookie: admin.cookie, 'content-type': 'application/json' },
      payload: { name: 'My Report', description: 'A test report', definition: validDef },
    });
    expect(post.statusCode).toBe(201);
    const created = post.json();
    expect(created).toMatchObject({ name: 'My Report', description: 'A test report' });
    expect(created.definition).toMatchObject({ source: 'tickets', measure: { id: 'count' } });
    const id = created.id;

    // list → includes summary with visualization
    const list = await app.inject({ method: 'GET', url: '/api/v1/reports', headers: { cookie: admin.cookie } });
    expect(list.statusCode).toBe(200);
    expect(list.json()).toHaveLength(1);
    expect(list.json()[0]).toMatchObject({ id, name: 'My Report', visualization: 'table' });
    expect(list.json()[0]).not.toHaveProperty('definition'); // summary only

    // get full
    const get = await app.inject({ method: 'GET', url: `/api/v1/reports/${id}`, headers: { cookie: admin.cookie } });
    expect(get.statusCode).toBe(200);
    expect(get.json()).toMatchObject({ id, name: 'My Report', description: 'A test report' });
    expect(get.json().definition).toMatchObject({ source: 'tickets' });

    // patch
    const patch = await app.inject({
      method: 'PATCH',
      url: `/api/v1/reports/${id}`,
      headers: { cookie: admin.cookie, 'content-type': 'application/json' },
      payload: { name: 'Updated Report' },
    });
    expect(patch.statusCode).toBe(200);
    expect(patch.json()).toMatchObject({ id, name: 'Updated Report' });

    // delete
    const del = await app.inject({ method: 'DELETE', url: `/api/v1/reports/${id}`, headers: { cookie: admin.cookie } });
    expect(del.statusCode).toBe(204);

    // gone after delete
    const getAfterDel = await app.inject({ method: 'GET', url: `/api/v1/reports/${id}`, headers: { cookie: admin.cookie } });
    expect(getAfterDel.statusCode).toBe(404);
  });

  it('CRUD works for agent too', async () => {
    const { agent } = await staffOrg();

    const post = await app.inject({
      method: 'POST',
      url: '/api/v1/reports',
      headers: { cookie: agent.cookie, 'content-type': 'application/json' },
      payload: { name: 'Agent Report', definition: validDef },
    });
    expect(post.statusCode).toBe(201);

    const list = await app.inject({ method: 'GET', url: '/api/v1/reports', headers: { cookie: agent.cookie } });
    expect(list.json()).toHaveLength(1);
  });

  it('GET /reports is 403 for a requester (staff-only)', async () => {
    const { requester } = await staffOrg();
    const res = await app.inject({ method: 'GET', url: '/api/v1/reports', headers: { cookie: requester.cookie } });
    expect(res.statusCode).toBe(403);
  });

  it('POST /reports is 403 for a requester', async () => {
    const { requester } = await staffOrg();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reports',
      headers: { cookie: requester.cookie, 'content-type': 'application/json' },
      payload: { name: 'Should Fail', definition: validDef },
    });
    expect(res.statusCode).toBe(403);
  });

  it('org isolation: org B cannot see or mutate org A reports', async () => {
    const { admin: adminA } = await staffOrg();

    // Create in org A
    const post = await app.inject({
      method: 'POST',
      url: '/api/v1/reports',
      headers: { cookie: adminA.cookie, 'content-type': 'application/json' },
      payload: { name: 'Org A Report', definition: validDef },
    });
    expect(post.statusCode).toBe(201);
    const id = post.json().id;

    // Set up org B
    const [orgB] = await db.insert(orgs).values({ name: 'Org B', slug: `org-b-${crypto.randomUUID()}` }).returning();
    const adminB = await loginAs(app, db, { orgId: orgB.id, role: 'admin' });

    // Org B list → empty
    const listB = await app.inject({ method: 'GET', url: '/api/v1/reports', headers: { cookie: adminB.cookie } });
    expect(listB.json()).toEqual([]);

    // Org B direct GET → 404
    const getB = await app.inject({ method: 'GET', url: `/api/v1/reports/${id}`, headers: { cookie: adminB.cookie } });
    expect(getB.statusCode).toBe(404);

    // Org B PATCH → 404
    const patchB = await app.inject({
      method: 'PATCH',
      url: `/api/v1/reports/${id}`,
      headers: { cookie: adminB.cookie, 'content-type': 'application/json' },
      payload: { name: 'Hijacked' },
    });
    expect(patchB.statusCode).toBe(404);

    // Org B DELETE → 404
    const delB = await app.inject({ method: 'DELETE', url: `/api/v1/reports/${id}`, headers: { cookie: adminB.cookie } });
    expect(delB.statusCode).toBe(404);

    // Org B GET /:id/run → 404
    const runB = await app.inject({ method: 'GET', url: `/api/v1/reports/${id}/run`, headers: { cookie: adminB.cookie } });
    expect(runB.statusCode).toBe(404);

    // Org A's report is unchanged — re-GET as org A confirms it still exists with its original name
    const reGet = await app.inject({ method: 'GET', url: `/api/v1/reports/${id}`, headers: { cookie: adminA.cookie } });
    expect(reGet.statusCode).toBe(200);
    expect(reGet.json().name).toBe('Org A Report');
  });

  it('POST /reports/run returns rows for seeded tickets', async () => {
    const { orgId, schemaId, schemaVersion, admin } = await staffOrg();
    const repo = ticketsRepo(db);

    // Seed 3 open + 2 resolved tickets
    await repo.create({ orgId, schemaId, schemaVersion, status: 'open' });
    await repo.create({ orgId, schemaId, schemaVersion, status: 'open' });
    await repo.create({ orgId, schemaId, schemaVersion, status: 'open' });
    await repo.create({ orgId, schemaId, schemaVersion, status: 'resolved' });
    await repo.create({ orgId, schemaId, schemaVersion, status: 'resolved' });

    const def: ReportDefinition = {
      source: 'tickets',
      measure: { id: 'count' },
      groupBy: { field: 'status' },
      visualization: 'bar',
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reports/run',
      headers: { cookie: admin.cookie, 'content-type': 'application/json' },
      payload: { definition: def },
    });
    expect(res.statusCode).toBe(200);
    const { rows } = res.json();
    expect(rows).toHaveLength(2);
    const total = rows.reduce((sum: number, r: { value: number }) => sum + r.value, 0);
    expect(total).toBe(5);
    // ordered by value desc — open (3) first
    expect(rows[0].key).toBe('open');
    expect(rows[0].value).toBe(3);
  });

  it('GET /reports/:id/run runs the saved report', async () => {
    const { orgId, schemaId, schemaVersion, admin } = await staffOrg();
    const repo = ticketsRepo(db);

    await repo.create({ orgId, schemaId, schemaVersion, status: 'open' });
    await repo.create({ orgId, schemaId, schemaVersion, status: 'in_progress' });

    // Save the report first
    const post = await app.inject({
      method: 'POST',
      url: '/api/v1/reports',
      headers: { cookie: admin.cookie, 'content-type': 'application/json' },
      payload: { name: 'Saved Count', definition: validDef },
    });
    expect(post.statusCode).toBe(201);
    const id = post.json().id;

    const runRes = await app.inject({
      method: 'GET',
      url: `/api/v1/reports/${id}/run`,
      headers: { cookie: admin.cookie },
    });
    expect(runRes.statusCode).toBe(200);
    expect(runRes.json().rows).toHaveLength(1);
    expect(runRes.json().rows[0].value).toBe(2);
  });

  it('GET /reports/:id/run returns 404 for unknown report', async () => {
    const { admin } = await staffOrg();
    const fakeId = crypto.randomUUID();
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/reports/${fakeId}/run`,
      headers: { cookie: admin.cookie },
    });
    expect(res.statusCode).toBe(404);
  });

  it('POST /reports/run with unknown measure returns 400', async () => {
    const { admin } = await staffOrg();

    // We have to bypass the zod validation — the measure id is validated loosely (z.string().min(1))
    // so an unknown id passes body validation and fails at the engine level.
    const badDef = {
      source: 'tickets',
      measure: { id: 'nonexistent_measure_xyz' },
      visualization: 'number',
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reports/run',
      headers: { cookie: admin.cookie, 'content-type': 'application/json' },
      payload: { definition: badDef },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().title).toBe('Invalid Report');
  });

  it('POST /reports/run applies team scope: agent sees only their team tickets', async () => {
    // One org, two ticket schemas, two teams — each team owns one schema.
    // An agent is a member of team 1 only.
    const { orgId, schemaId: schemaId1, schemaVersion: schemaVersion1 } = await seedOrgAndSchema(db, 'ticket');

    // Second schema in the same org
    const [schema2Row] = await db
      .insert(schemas)
      .values({
        orgId,
        kind: 'ticket',
        key: `ticket_schema2_${crypto.randomUUID()}`,
        name: 'Schema 2',
        status: 'published',
        definition: { fields: [] },
      })
      .returning();
    const schemaId2 = schema2Row.id;
    const schemaVersion2 = schema2Row.version;

    // Two teams
    const [team1] = await db.insert(teams).values({ orgId, name: 'Team 1' }).returning();
    const [team2] = await db.insert(teams).values({ orgId, name: 'Team 2' }).returning();

    // Link each team to one schema
    await db.insert(teamSchemas).values({ teamId: team1.id, schemaId: schemaId1 });
    await db.insert(teamSchemas).values({ teamId: team2.id, schemaId: schemaId2 });

    // Seed tickets: 2 under schema 1 (team 1), 3 under schema 2 (team 2)
    const repo = ticketsRepo(db);
    await repo.create({ orgId, schemaId: schemaId1, schemaVersion: schemaVersion1, status: 'open' });
    await repo.create({ orgId, schemaId: schemaId1, schemaVersion: schemaVersion1, status: 'open' });
    await repo.create({ orgId, schemaId: schemaId2, schemaVersion: schemaVersion2, status: 'open' });
    await repo.create({ orgId, schemaId: schemaId2, schemaVersion: schemaVersion2, status: 'open' });
    await repo.create({ orgId, schemaId: schemaId2, schemaVersion: schemaVersion2, status: 'open' });

    // Admin can see all 5 tickets
    const admin = await loginAs(app, db, { orgId, role: 'admin' });

    // Agent is a member of team 1 only
    const { cookie: agentCookie, userId: agentId } = await loginAs(app, db, { orgId, role: 'agent' });
    await db.insert(teamMembers).values({ teamId: team1.id, userId: agentId });

    const runDef = { definition: { source: 'tickets', measure: { id: 'count' } } };

    const adminRes = await app.inject({
      method: 'POST',
      url: '/api/v1/reports/run',
      headers: { cookie: admin.cookie, 'content-type': 'application/json' },
      payload: runDef,
    });
    expect(adminRes.statusCode).toBe(200);
    const adminCount = adminRes.json().rows[0].value as number;

    const agentRes = await app.inject({
      method: 'POST',
      url: '/api/v1/reports/run',
      headers: { cookie: agentCookie, 'content-type': 'application/json' },
      payload: runDef,
    });
    expect(agentRes.statusCode).toBe(200);
    const agentCount = agentRes.json().rows[0].value as number;

    // Agent sees only team 1's tickets (2), admin sees all (5)
    expect(agentCount).toBe(2);
    expect(adminCount).toBe(5);
    expect(agentCount).toBeLessThan(adminCount);
  });
});
