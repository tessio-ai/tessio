// SPDX-License-Identifier: AGPL-3.0-only

import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Db } from '@tessio/db';
import { agentDevicesRepo, agentSoftwareRepo, assetsRepo } from '@tessio/db';
import { ApiError } from '../errors';
import { queryBody } from '../resources/schemas';

const idParam = z.object({ id: z.string().uuid() });
const linkBody = z.object({ assetId: z.string().uuid() });

/** Device row as presented to staff — never includes the token hash. */
type DeviceRow = Record<string, unknown>;
function present(d: DeviceRow) {
  const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : null);
  return {
    id: d.id,
    hostname: d.hostname,
    osType: d.osType,
    osVersion: d.osVersion ?? null,
    osBuild: d.osBuild ?? null,
    manufacturer: d.manufacturer ?? null,
    model: d.model ?? null,
    serial: d.serial ?? null,
    cpu: d.cpu ?? null,
    cpuCores: d.cpuCores ?? null,
    ramBytes: d.ramBytes ?? null,
    lastUser: d.lastUser ?? null,
    lastBootAt: iso(d.lastBootAt),
    agentVersion: d.agentVersion ?? null,
    status: d.status,
    machineId: d.machineId,
    firstSeenAt: iso(d.firstSeenAt),
    lastSeenAt: iso(d.lastSeenAt),
    lastReportAt: iso(d.lastReportAt),
    linkedAssetId: d.linkedAssetId ?? null,
    data: d.data ?? {},
  };
}

const pageResponse = z.object({ rows: z.array(z.record(z.unknown())), nextCursor: z.string().nullable() });

/** Staff-only device inventory. Caller must be guarded by requireRole('agent','admin'). */
export function registerDevicesRoutes(app: FastifyInstance, db: Db): void {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const devices = agentDevicesRepo(db);
  const software = agentSoftwareRepo(db);
  const assets = assetsRepo(db);

  r.post('/agent/devices/query', { schema: { body: queryBody, response: { 200: pageResponse } } }, async (req) => {
    const { rows, nextCursor } = await devices.query(req.orgId, req.body);
    return { rows: rows.map((d) => present(d as DeviceRow)), nextCursor };
  });

  r.get('/agent/devices/:id', { schema: { params: idParam, response: { 200: z.record(z.unknown()) } } }, async (req) => {
    const device = await devices.getById(req.orgId, req.params.id);
    if (!device) throw new ApiError(404, 'Not Found', 'No such device.');
    const sw = await software.listForDevice(req.params.id);
    return {
      ...present(device as DeviceRow),
      software: sw.map((s) => ({
        name: s.name,
        version: s.version,
        publisher: s.publisher,
        installedAt: s.installedAt ? s.installedAt.toISOString() : null,
      })),
    };
  });

  r.post('/agent/devices/:id/link', { schema: { params: idParam, body: linkBody, response: { 200: z.record(z.unknown()) } } }, async (req) => {
    // The linked asset must belong to the caller's org — otherwise a staff user could
    // point a device at another org's asset UUID (cross-tenant reference).
    const asset = await assets.getById(req.orgId, req.body.assetId);
    if (!asset) throw new ApiError(404, 'Not Found', 'No such asset.');
    const row = await devices.linkAsset(req.orgId, req.params.id, req.body.assetId, req.user.id);
    if (!row) throw new ApiError(404, 'Not Found', 'No such device.');
    return present(row as DeviceRow);
  });

  r.post('/agent/devices/:id/unlink', { schema: { params: idParam, response: { 200: z.record(z.unknown()) } } }, async (req) => {
    const row = await devices.unlinkAsset(req.orgId, req.params.id, req.user.id);
    if (!row) throw new ApiError(404, 'Not Found', 'No such device.');
    return present(row as DeviceRow);
  });

  r.delete('/agent/devices/:id', { schema: { params: idParam, response: { 204: z.null() } } }, async (req, reply) => {
    await devices.softDelete(req.orgId, req.params.id);
    reply.code(204);
    return null;
  });
}
