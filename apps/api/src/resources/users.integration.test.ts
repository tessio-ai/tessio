// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { buildTestApp, resetDb, seedOrgAndSchema, createTestDb, loginAs } from '../testing/harness';
import { usersRepo, hashPassword } from '@tessio/db';

const db = createTestDb();
const { app, teardown } = buildTestApp();

describe('users resource (admin only)', () => {
  beforeEach(async () => { await resetDb(db); });
  afterAll(async () => { await db.$client.end(); await teardown(); });

  it('lets an admin create and list users, never leaking passwordHash', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    const admin = await loginAs(app, db, { orgId, role: 'admin' });
    const create = await app.inject({
      method: 'POST', url: '/api/v1/users', headers: { cookie: admin.cookie },
      payload: { email: 'new.agent@acme.io', name: 'New Agent', role: 'agent', password: 'pw123456' },
    });
    expect(create.statusCode).toBe(201);
    expect(create.json().passwordHash).toBeUndefined();
    expect(create.json().role).toBe('agent');

    const list = await app.inject({ method: 'GET', url: '/api/v1/users', headers: { cookie: admin.cookie } });
    expect(list.statusCode).toBe(200);
    expect(list.json().some((u: { email: string }) => u.email === 'new.agent@acme.io')).toBe(true);
    expect(list.json()[0].passwordHash).toBeUndefined();
  });

  it('forbids an agent from creating users', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    const agent = await loginAs(app, db, { orgId, role: 'agent' });
    const res = await app.inject({ method: 'POST', url: '/api/v1/users', headers: { cookie: agent.cookie },
      payload: { email: 'new@x.io', name: 'New', role: 'agent', password: 'secret123' } });
    expect(res.statusCode).toBe(403);
  });

  it('lets an agent list users but not create them', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    await usersRepo(db).create({ orgId, email: 'a@x.io', name: 'A', role: 'agent', passwordHash: await hashPassword('secret123') });
    const { cookie } = await loginAs(app, db, { orgId, role: 'agent' });
    const list = await app.inject({ method: 'GET', url: '/api/v1/users', headers: { cookie } });
    expect(list.statusCode).toBe(200);
    const create = await app.inject({ method: 'POST', url: '/api/v1/users', headers: { cookie },
      payload: { email: 'new@x.io', name: 'New', role: 'agent', password: 'secret123' } });
    expect(create.statusCode).toBe(403);
  });

  it('lets an admin disable a user', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    const admin = await loginAs(app, db, { orgId, role: 'admin' });
    const created = (await app.inject({ method: 'POST', url: '/api/v1/users', headers: { cookie: admin.cookie }, payload: { email: 'x@y.io', name: 'X', role: 'requester', password: 'pw123456' } })).json();
    const res = await app.inject({ method: 'PATCH', url: `/api/v1/users/${created.id}`, headers: { cookie: admin.cookie }, payload: { status: 'disabled' } });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('disabled');
  });
});
