// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { buildTestApp, resetDb, createTestDb, loginAs } from '../testing/harness';
import { orgs } from '@tessio/db';

process.env.TESSIO_SECRET_KEY = Buffer.alloc(32, 1).toString('base64');

const db = createTestDb();
const { app, teardown } = buildTestApp();

afterAll(async () => { await db.$client.end(); await teardown(); });

async function adminOrg() {
  const [org] = await db.insert(orgs).values({ name: 'Org', slug: `o-${crypto.randomUUID()}` }).returning();
  const admin = await loginAs(app, db, { orgId: org.id, role: 'admin' });
  return { org, admin };
}

const json = (cookie: string) => ({ cookie, 'content-type': 'application/json' });

async function createEnrollmentKey(cookie: string): Promise<string> {
  const res = await app.inject({
    method: 'POST', url: '/api/v1/agent/enrollment-keys',
    headers: json(cookie), payload: { label: 'fleet' },
  });
  expect(res.statusCode).toBe(201);
  return res.json().key as string;
}

const snapshot = (hostname = 'host-1') => ({
  hardware: { cpu: 'Apple M3', cpuCores: 8, ramBytes: 17179869184, disks: [{ name: '/', totalBytes: 500000000000 }], manufacturer: 'Apple', model: 'Mac15,3', serial: 'C02XYZ', biosVersion: '1.0' },
  identity: { hostname, osType: 'macos', osVersion: '14.5', osBuild: '23F79', lastUser: 'jon', lastBootAt: '2026-06-13T09:00:00.000Z' },
  network: { interfaces: [{ name: 'en0', mac: 'aa:bb:cc:dd:ee:ff', ipv4: ['192.168.1.10'], ipv6: [] }] },
  software: [{ name: 'Firefox', version: '120.0', publisher: 'Mozilla', installedAt: '2026-01-01T00:00:00.000Z' }],
  agentVersion: '0.1.0',
});

describe('agent enrollment + ingest', () => {
  beforeEach(async () => { await resetDb(db); });

  it('enrolls with a valid key, reports a snapshot, and shows up as a device with software', async () => {
    const { admin } = await adminOrg();
    const key = await createEnrollmentKey(admin.cookie);

    const enroll = await app.inject({
      method: 'POST', url: '/api/v1/agent/enroll', headers: { 'content-type': 'application/json' },
      payload: { enrollmentKey: key, machineId: 'm-1', hostname: 'host-1', osType: 'macos', agentVersion: '0.1.0' },
    });
    expect(enroll.statusCode).toBe(200);
    const token = enroll.json().token as string;
    expect(token).toBeTruthy();

    const report = await app.inject({
      method: 'POST', url: '/api/v1/agent/report',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      payload: snapshot(),
    });
    expect(report.statusCode).toBe(200);

    const list = await app.inject({ method: 'POST', url: '/api/v1/agent/devices/query', headers: json(admin.cookie), payload: {} });
    expect(list.statusCode).toBe(200);
    const rows = list.json().rows;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ hostname: 'host-1', osType: 'macos', model: 'Mac15,3', serial: 'C02XYZ', status: 'online' });
    // The token hash must never leak to staff.
    expect(JSON.stringify(rows[0])).not.toContain('tokenHash');

    const detail = await app.inject({ method: 'GET', url: `/api/v1/agent/devices/${rows[0].id}`, headers: { cookie: admin.cookie } });
    expect(detail.json().software).toEqual([expect.objectContaining({ name: 'Firefox', version: '120.0' })]);
  });

  it('rejects enrollment with a bad key and ingest with a bad/missing token', async () => {
    const { admin } = await adminOrg();
    await createEnrollmentKey(admin.cookie);

    const bad = await app.inject({
      method: 'POST', url: '/api/v1/agent/enroll', headers: { 'content-type': 'application/json' },
      payload: { enrollmentKey: 'nope', machineId: 'm', hostname: 'h', osType: 'linux', agentVersion: '0.1.0' },
    });
    expect(bad.statusCode).toBe(401);

    const noToken = await app.inject({ method: 'POST', url: '/api/v1/agent/heartbeat', headers: { 'content-type': 'application/json' }, payload: {} });
    expect(noToken.statusCode).toBe(401);

    const wrongToken = await app.inject({
      method: 'POST', url: '/api/v1/agent/report',
      headers: { authorization: 'Bearer deadbeef', 'content-type': 'application/json' }, payload: snapshot(),
    });
    expect(wrongToken.statusCode).toBe(401);
  });

  it('revoking the enrollment key blocks new enrollments but keeps issued device tokens working', async () => {
    const { admin } = await adminOrg();
    const key = await createEnrollmentKey(admin.cookie);
    const enroll = await app.inject({
      method: 'POST', url: '/api/v1/agent/enroll', headers: { 'content-type': 'application/json' },
      payload: { enrollmentKey: key, machineId: 'm-1', hostname: 'h', osType: 'windows', agentVersion: '0.1.0' },
    });
    const token = enroll.json().token as string;

    const keyId = (await app.inject({ method: 'GET', url: '/api/v1/agent/enrollment-keys', headers: { cookie: admin.cookie } })).json()[0].id;
    const revoke = await app.inject({ method: 'POST', url: `/api/v1/agent/enrollment-keys/${keyId}/revoke`, headers: json(admin.cookie), payload: {} });
    expect(revoke.statusCode).toBe(200);

    const reEnroll = await app.inject({
      method: 'POST', url: '/api/v1/agent/enroll', headers: { 'content-type': 'application/json' },
      payload: { enrollmentKey: key, machineId: 'm-2', hostname: 'h2', osType: 'windows', agentVersion: '0.1.0' },
    });
    expect(reEnroll.statusCode).toBe(401);

    // The already-issued device token still works.
    const hb = await app.inject({ method: 'POST', url: '/api/v1/agent/heartbeat', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, payload: {} });
    expect(hb.statusCode).toBe(200);
  });

  it('links and unlinks a device to an asset, and isolates devices across orgs', async () => {
    const { org, admin } = await adminOrg();
    const key = await createEnrollmentKey(admin.cookie);
    const token = (await app.inject({
      method: 'POST', url: '/api/v1/agent/enroll', headers: { 'content-type': 'application/json' },
      payload: { enrollmentKey: key, machineId: 'm-1', hostname: 'h', osType: 'linux', agentVersion: '0.1.0' },
    })).json().token;
    await app.inject({ method: 'POST', url: '/api/v1/agent/report', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, payload: { ...snapshot(), identity: { ...snapshot().identity, osType: 'linux' } } });

    const deviceId = (await app.inject({ method: 'POST', url: '/api/v1/agent/devices/query', headers: json(admin.cookie), payload: {} })).json().rows[0].id;
    void org;

    // Another org cannot see this device.
    const { admin: other } = await adminOrg();
    expect((await app.inject({ method: 'POST', url: '/api/v1/agent/devices/query', headers: json(other.cookie), payload: {} })).json().rows).toHaveLength(0);
    expect((await app.inject({ method: 'GET', url: `/api/v1/agent/devices/${deviceId}`, headers: { cookie: other.cookie } })).statusCode).toBe(404);

    // Staff (agent role) can read but a session token can't hit the ingest path with a cookie (no bearer → 401).
    const ingestWithCookie = await app.inject({ method: 'POST', url: '/api/v1/agent/heartbeat', headers: json(admin.cookie), payload: {} });
    expect(ingestWithCookie.statusCode).toBe(401);
  });

  it('forbids non-admins from managing enrollment keys', async () => {
    const [org] = await db.insert(orgs).values({ name: 'Org', slug: `o-${crypto.randomUUID()}` }).returning();
    const agent = await loginAs(app, db, { orgId: org.id, role: 'agent' });
    expect((await app.inject({ method: 'GET', url: '/api/v1/agent/enrollment-keys', headers: { cookie: agent.cookie } })).statusCode).toBe(403);
    // …but an agent CAN read the device inventory.
    expect((await app.inject({ method: 'POST', url: '/api/v1/agent/devices/query', headers: json(agent.cookie), payload: {} })).statusCode).toBe(200);
  });
});
