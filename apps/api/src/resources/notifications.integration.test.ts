// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { buildTestApp, resetDb, seedOrgAndSchema, createTestDb, loginAs } from '../testing/harness';
import { notificationsRepo } from '@tessio/db';

const db = createTestDb();
const { app, teardown } = buildTestApp();

describe('notifications resource', () => {
  beforeEach(async () => { await resetDb(db); });
  afterAll(async () => { await db.$client.end(); await teardown(); });

  it('GET returns empty list when no notifications', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    const agent = await loginAs(app, db, { orgId, role: 'agent' });
    const res = await app.inject({ method: 'GET', url: '/api/v1/notifications', headers: { cookie: agent.cookie } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items).toHaveLength(0);
    expect(body.unreadCount).toBe(0);
  });

  it('GET returns seeded notification with unreadCount=1', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    const { cookie, userId } = await loginAs(app, db, { orgId, role: 'agent' });
    await notificationsRepo(db).create({
      orgId,
      userId,
      type: 'assigned',
      title: 'Ticket assigned to you',
      snippet: 'Printer issue',
    });
    const res = await app.inject({ method: 'GET', url: '/api/v1/notifications', headers: { cookie } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].title).toBe('Ticket assigned to you');
    expect(body.unreadCount).toBe(1);
  });

  it('POST read-all marks all read; unreadCount becomes 0', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    const { cookie, userId } = await loginAs(app, db, { orgId, role: 'agent' });
    await notificationsRepo(db).createMany([
      { orgId, userId, type: 'assigned', title: 'A', snippet: '' },
      { orgId, userId, type: 'reply', title: 'B', snippet: '' },
    ]);
    const readAll = await app.inject({ method: 'POST', url: '/api/v1/notifications/read-all', headers: { cookie } });
    expect(readAll.statusCode).toBe(204);

    const list = await app.inject({ method: 'GET', url: '/api/v1/notifications', headers: { cookie } });
    expect(list.json().unreadCount).toBe(0);
  });

  it('POST /:id/read marks a single notification read', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    const { cookie, userId } = await loginAs(app, db, { orgId, role: 'agent' });
    const n = await notificationsRepo(db).create({ orgId, userId, type: 'reply', title: 'Comment', snippet: '' });
    const mark = await app.inject({ method: 'POST', url: `/api/v1/notifications/${n!.id}/read`, headers: { cookie } });
    expect(mark.statusCode).toBe(204);

    const list = await app.inject({ method: 'GET', url: '/api/v1/notifications', headers: { cookie } });
    expect(list.json().unreadCount).toBe(0);
    expect(list.json().items[0].readAt).not.toBeNull();
  });

  it('does not expose notifications of another user', async () => {
    const { orgId } = await seedOrgAndSchema(db, 'ticket');
    const a = await loginAs(app, db, { orgId, role: 'agent' });
    const b = await loginAs(app, db, { orgId, role: 'agent' });
    await notificationsRepo(db).create({ orgId, userId: a.userId, type: 'assigned', title: 'For A', snippet: '' });
    const res = await app.inject({ method: 'GET', url: '/api/v1/notifications', headers: { cookie: b.cookie } });
    expect(res.json().items).toHaveLength(0);
  });
});
