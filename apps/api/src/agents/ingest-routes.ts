// SPDX-License-Identifier: AGPL-3.0-only

import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Db } from '@tessio/db';
import { agentEnrollmentKeysRepo, agentDevicesRepo, agentSoftwareRepo } from '@tessio/db';
import { enrollRequest, enrollResponse, snapshotReport, heartbeatRequest } from '@tessio/shared';
import { ApiError } from '../errors';
import { generateToken, hashToken, bearerToken } from './token';

const okResponse = z.object({ ok: z.boolean() });

/** Tight limits for unauthenticated/agent traffic (inert under test, where the plugin is off). */
const enrollLimit = { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } };
const reportLimit = { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } };

function toDate(iso: string | null | undefined): Date | null {
  return iso ? new Date(iso) : null;
}

/**
 * Endpoint-agent ingest routes. Mounted on the /api/v1 parent scope (NOT the
 * session-cookie scope): every call authenticates with a Bearer token instead.
 */
export function registerAgentIngestRoutes(app: FastifyInstance, db: Db): void {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const keys = agentEnrollmentKeysRepo(db);
  const devices = agentDevicesRepo(db);
  const software = agentSoftwareRepo(db);

  /** Resolve the device behind a Bearer device token, or 401. */
  async function deviceFromBearer(req: FastifyRequest) {
    const presented = bearerToken(req);
    if (!presented) throw new ApiError(401, 'Unauthorized', 'Missing device token');
    const device = await devices.findByTokenHash(hashToken(presented));
    if (!device) throw new ApiError(401, 'Unauthorized', 'Unknown or revoked device token');
    return device;
  }

  // First-run enrollment with the org enrollment key.
  r.post('/agent/enroll', { ...enrollLimit, schema: { body: enrollRequest, response: { 200: enrollResponse } } }, async (req) => {
    const { enrollmentKey, machineId, hostname, osType, agentVersion } = req.body;
    const key = await keys.findActiveByHash(hashToken(enrollmentKey));
    if (!key) throw new ApiError(401, 'Unauthorized', 'Invalid enrollment key');
    // A device an admin has removed must not be silently re-enrolled (and re-issued a
    // working token) by anyone holding the shared enrollment key — require admin re-add.
    const prior = await devices.findByMachineId(key.orgId, machineId);
    if (prior?.deletedAt) {
      throw new ApiError(409, 'Conflict', 'This device was removed by an administrator and cannot self-re-enroll.');
    }
    const token = generateToken();
    const device = await devices.upsertByMachineId({
      orgId: key.orgId,
      machineId,
      enrollmentKeyId: key.id,
      tokenHash: hashToken(token),
      hostname,
      osType,
      agentVersion,
    });
    return { deviceId: device.id, token };
  });

  // Full inventory snapshot — replaces the device's hardware/OS/network fields and software list.
  r.post('/agent/report', { ...reportLimit, schema: { body: snapshotReport, response: { 200: okResponse } } }, async (req) => {
    const device = await deviceFromBearer(req);
    const b = req.body;
    await devices.applySnapshot(device.id, {
      hostname: b.identity.hostname,
      osType: b.identity.osType,
      osVersion: b.identity.osVersion ?? null,
      osBuild: b.identity.osBuild ?? null,
      lastUser: b.identity.lastUser ?? null,
      lastBootAt: toDate(b.identity.lastBootAt),
      manufacturer: b.hardware.manufacturer ?? null,
      model: b.hardware.model ?? null,
      serial: b.hardware.serial ?? null,
      cpu: b.hardware.cpu ?? null,
      cpuCores: b.hardware.cpuCores ?? null,
      ramBytes: b.hardware.ramBytes ?? null,
      agentVersion: b.agentVersion,
      data: { interfaces: b.network.interfaces, disks: b.hardware.disks, biosVersion: b.hardware.biosVersion ?? null },
    });
    await software.replaceForDevice(
      device.orgId,
      device.id,
      b.software.map((s) => ({
        name: s.name,
        version: s.version ?? null,
        publisher: s.publisher ?? null,
        installedAt: toDate(s.installedAt),
      })),
    );
    return { ok: true };
  });

  // Lightweight liveness ping.
  r.post('/agent/heartbeat', { ...reportLimit, schema: { body: heartbeatRequest, response: { 200: okResponse } } }, async (req) => {
    const device = await deviceFromBearer(req);
    await devices.heartbeat(device.id);
    return { ok: true };
  });
}
