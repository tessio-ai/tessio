// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { buildTestApp, resetDb, seedOrgAndSchema, createTestDb, loginAs } from '../testing/harness';
import { ticketsRepo, aiSettingsRepo } from '@tessio/db';

// Ensure a TESSIO_SECRET_KEY is set so the app boots without complaint
process.env.TESSIO_SECRET_KEY = Buffer.alloc(32, 1).toString('base64');

const db = createTestDb();
const { app, teardown } = buildTestApp();

afterAll(async () => {
  await db.$client.end();
  await teardown();
});

describe('GET /tickets/:id/ai/triage — tenant isolation', () => {
  beforeEach(async () => {
    await resetDb(db);
  });

  it('returns 404 when a user from org B tries to read a triage for a ticket in org A', async () => {
    // Org A: create a ticket
    const a = await seedOrgAndSchema(db, 'ticket');
    const ticketA = await ticketsRepo(db).create({
      orgId: a.orgId,
      schemaId: a.schemaId,
      schemaVersion: a.schemaVersion,
      data: { title: 'Ticket in org A' },
    });

    // Org B: a different org with its own schema
    const b = await seedOrgAndSchema(db, 'ticket');
    const { cookie: cookieB } = await loginAs(app, db, { orgId: b.orgId, role: 'admin' });

    // Org B user tries to read org A's ticket triage → must 404
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/tickets/${ticketA.id}/ai/triage`,
      headers: { cookie: cookieB },
    });
    expect(res.statusCode).toBe(404);
  });

  it('returns 200 with null body when the ticket belongs to the caller\'s org but has no triage yet', async () => {
    const a = await seedOrgAndSchema(db, 'ticket');
    const ticketA = await ticketsRepo(db).create({
      orgId: a.orgId,
      schemaId: a.schemaId,
      schemaVersion: a.schemaVersion,
      data: { title: 'Ticket in org A' },
    });

    const { cookie: cookieA } = await loginAs(app, db, { orgId: a.orgId, role: 'admin' });

    // Same-org request with no triage stored → 200 + null
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/tickets/${ticketA.id}/ai/triage`,
      headers: { cookie: cookieA },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toBeNull();
  });
});

describe('GET /tickets/:id/ai/similar', () => {
  beforeEach(async () => {
    await resetDb(db);
  });

  it('returns 200 with [] when the ticket belongs to the caller\'s org but has no embeddings yet', async () => {
    // Org A: create a ticket and enable similar
    const a = await seedOrgAndSchema(db, 'ticket');
    const ticketA = await ticketsRepo(db).create({
      orgId: a.orgId,
      schemaId: a.schemaId,
      schemaVersion: a.schemaVersion,
      data: { title: 'Ticket in org A' },
    });

    await aiSettingsRepo(db).getOrCreate(a.orgId);
    await aiSettingsRepo(db).update(a.orgId, {
      enabled: true,
      features: { summary: false, draft: false, triage: false, similar: true, ask: false },
    });

    const { cookie: cookieA } = await loginAs(app, db, { orgId: a.orgId, role: 'admin' });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/tickets/${ticketA.id}/ai/similar`,
      headers: { cookie: cookieA },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it('returns 404 when a user from org A tries to get similar tickets for a ticket in org B', async () => {
    // Org A: enable similar
    const a = await seedOrgAndSchema(db, 'ticket');
    await aiSettingsRepo(db).getOrCreate(a.orgId);
    await aiSettingsRepo(db).update(a.orgId, {
      enabled: true,
      features: { summary: false, draft: false, triage: false, similar: true, ask: false },
    });

    // Org B: create a ticket (similar not needed for org B)
    const b = await seedOrgAndSchema(db, 'ticket');
    const ticketB = await ticketsRepo(db).create({
      orgId: b.orgId,
      schemaId: b.schemaId,
      schemaVersion: b.schemaVersion,
      data: { title: 'Ticket in org B' },
    });

    const { cookie: cookieA } = await loginAs(app, db, { orgId: a.orgId, role: 'admin' });

    // Org A user tries to read org B's ticket similar → must 404 (source ticket is org-scoped)
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/tickets/${ticketB.id}/ai/similar`,
      headers: { cookie: cookieA },
    });
    expect(res.statusCode).toBe(404);
  });

  it('returns 409 when the similar feature is not enabled for the caller\'s org', async () => {
    // Org C: do NOT enable similar (leave defaults)
    const c = await seedOrgAndSchema(db, 'ticket');
    const ticketC = await ticketsRepo(db).create({
      orgId: c.orgId,
      schemaId: c.schemaId,
      schemaVersion: c.schemaVersion,
      data: { title: 'Ticket in org C' },
    });

    const { cookie: cookieC } = await loginAs(app, db, { orgId: c.orgId, role: 'admin' });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/tickets/${ticketC.id}/ai/similar`,
      headers: { cookie: cookieC },
    });
    expect(res.statusCode).toBe(409);
  });
});
