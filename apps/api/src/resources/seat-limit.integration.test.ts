// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Seat-limit enforcement, end to end against the community default (the free
 * allotment of 5 admin/agent seats). Covers every server path that can occupy
 * a new seat: create, bulk import, and the role/status transitions — plus the
 * paths that must stay open at the cap (requesters, non-seat edits, freeing a
 * seat then reusing it).
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { FREE_SEAT_LIMIT } from '@tessio/entitlements';
import { buildTestApp, resetDb, seedOrgAndSchema, createTestDb, loginAs, seedUser } from '../testing/harness';

process.env.TESSIO_SECRET_KEY = Buffer.alloc(32, 1).toString('base64');

const db = createTestDb();
// No TESSIO_EDITION / no license → community: seatLimit = FREE_SEAT_LIMIT.
const { app, teardown } = buildTestApp();

const newUser = (role: string) => ({
  email: `${role}-${crypto.randomUUID()}@t.io`,
  name: 'New Person',
  role,
  password: 'longenough1!',
});

/** Fill the org up to the free allotment (the admin session occupies seat #1). */
async function fillSeats(orgId: string, alreadyUsed: number): Promise<void> {
  for (let i = alreadyUsed; i < FREE_SEAT_LIMIT; i++) await seedUser(db, { orgId, role: 'agent' });
}

describe('seat-limit enforcement (community free tier)', () => {
  beforeAll(async () => {
    await app.ready();
  });
  beforeEach(async () => {
    await resetDb(db);
  });
  afterAll(async () => {
    await db.$client.end();
    await teardown();
  });

  it('allows billable creates below the limit, 402s the one that would exceed it', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    const admin = await loginAs(app, db, { orgId, role: 'admin' }); // seat 1

    for (let i = 2; i <= FREE_SEAT_LIMIT; i++) {
      const res = await app.inject({ method: 'POST', url: '/api/v1/users', headers: { cookie: admin.cookie }, payload: newUser('agent') });
      expect(res.statusCode).toBe(201);
    }

    const over = await app.inject({ method: 'POST', url: '/api/v1/users', headers: { cookie: admin.cookie }, payload: newUser('admin') });
    expect(over.statusCode).toBe(402);
    const body = over.json();
    expect(body.code).toBe('seat_limit_reached');
    expect(body.seatLimit).toBe(FREE_SEAT_LIMIT);
    expect(body.seatsUsed).toBe(FREE_SEAT_LIMIT);
  });

  it('still allows requesters at the cap — they are never billable', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    const admin = await loginAs(app, db, { orgId, role: 'admin' });
    await fillSeats(orgId, 1);

    const res = await app.inject({ method: 'POST', url: '/api/v1/users', headers: { cookie: admin.cookie }, payload: newUser('requester') });
    expect(res.statusCode).toBe(201);
  });

  it('bulk import creates up to the limit and skips the rest with a seat-limit reason', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    const admin = await loginAs(app, db, { orgId, role: 'admin' }); // seat 1

    const users = Array.from({ length: FREE_SEAT_LIMIT + 2 }, (_, i) => ({
      email: `import-${i}@t.io`,
      name: `Import ${i}`,
      role: 'agent',
    }));
    const res = await app.inject({ method: 'POST', url: '/api/v1/users/import', headers: { cookie: admin.cookie }, payload: { users } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.created).toHaveLength(FREE_SEAT_LIMIT - 1); // 4 free seats remained
    expect(body.skipped).toHaveLength(3);
    for (const s of body.skipped) expect(s.reason).toContain('seat limit reached');
  });

  it('bulk import still imports requesters after the billable seats run out', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    const admin = await loginAs(app, db, { orgId, role: 'admin' });
    await fillSeats(orgId, 1);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/users/import',
      headers: { cookie: admin.cookie },
      payload: { users: [
        { email: 'blocked-agent@t.io', name: 'Blocked', role: 'agent' },
        { email: 'fine-requester@t.io', name: 'Fine', role: 'requester' },
      ] },
    });
    const body = res.json();
    expect(body.created.map((u: { email: string }) => u.email)).toEqual(['fine-requester@t.io']);
    expect(body.skipped[0].reason).toContain('seat limit reached');
  });

  it('402s promoting a requester to agent at the cap; allows it after a seat frees up', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    const admin = await loginAs(app, db, { orgId, role: 'admin' });
    const { user: agent } = await seedUser(db, { orgId, role: 'agent' });
    await fillSeats(orgId, 2);
    const { user: requester } = await seedUser(db, { orgId, role: 'requester' });

    const promote = () =>
      app.inject({ method: 'PATCH', url: `/api/v1/users/${requester.id}`, headers: { cookie: admin.cookie }, payload: { role: 'agent' } });

    expect((await promote()).statusCode).toBe(402);

    // Disable an agent → a seat frees → the same promotion now succeeds.
    const disable = await app.inject({ method: 'PATCH', url: `/api/v1/users/${agent.id}`, headers: { cookie: admin.cookie }, payload: { status: 'disabled' } });
    expect(disable.statusCode).toBe(200);
    expect((await promote()).statusCode).toBe(200);
  });

  it('402s re-activating a disabled agent at the cap', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    const admin = await loginAs(app, db, { orgId, role: 'admin' });
    const { user: parked } = await seedUser(db, { orgId, role: 'agent' });
    await app.inject({ method: 'PATCH', url: `/api/v1/users/${parked.id}`, headers: { cookie: admin.cookie }, payload: { status: 'disabled' } });
    await fillSeats(orgId, 1);

    const reactivate = await app.inject({ method: 'PATCH', url: `/api/v1/users/${parked.id}`, headers: { cookie: admin.cookie }, payload: { status: 'active' } });
    expect(reactivate.statusCode).toBe(402);
  });

  it('non-seat edits stay allowed at the cap (demote, disable, requester ↔ requester)', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    const admin = await loginAs(app, db, { orgId, role: 'admin' });
    const { user: agent } = await seedUser(db, { orgId, role: 'agent' });
    await fillSeats(orgId, 2);

    // Demoting an agent to requester (frees a seat) must never be blocked.
    const demote = await app.inject({ method: 'PATCH', url: `/api/v1/users/${agent.id}`, headers: { cookie: admin.cookie }, payload: { role: 'requester' } });
    expect(demote.statusCode).toBe(200);

    // An active agent's role swap to admin is billable→billable: no new seat, allowed at cap.
    const { user: other } = await seedUser(db, { orgId, role: 'agent' }); // reuses the freed seat
    const swap = await app.inject({ method: 'PATCH', url: `/api/v1/users/${other.id}`, headers: { cookie: admin.cookie }, payload: { role: 'admin' } });
    expect(swap.statusCode).toBe(200);
  });

  it('/me/entitlements reflects live seat usage', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    const admin = await loginAs(app, db, { orgId, role: 'admin' });
    await seedUser(db, { orgId, role: 'agent' });
    await seedUser(db, { orgId, role: 'requester' }); // not counted

    const res = await app.inject({ method: 'GET', url: '/api/v1/me/entitlements', headers: { cookie: admin.cookie } });
    const body = res.json();
    expect(body.seatLimit).toBe(FREE_SEAT_LIMIT);
    expect(body.seatsUsed).toBe(2); // admin + agent, requester excluded
  });
});
