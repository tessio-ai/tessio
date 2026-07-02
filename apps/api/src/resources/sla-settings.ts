// SPDX-License-Identifier: AGPL-3.0-only

import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Db } from '@tessio/db';
import { slaSettingsRepo } from '@tessio/db';
import { slaTargetsSchema } from '@tessio/shared';
import { recordAudit, safeMeta } from '../audit';

const settingsResponse = z.object({
  enabled: z.boolean(),
  targets: slaTargetsSchema,
});

const putBody = z.object({
  enabled: z.boolean().optional(),
  targets: slaTargetsSchema.optional(),
});

function present(row: Awaited<ReturnType<ReturnType<typeof slaSettingsRepo>['getOrCreate']>>) {
  return {
    enabled: row!.enabled,
    targets: (row!.targets ?? {}) as z.infer<typeof slaTargetsSchema>,
  };
}

/** Admin-only SLA settings. Caller must be guarded by requireRole('admin'). */
export function registerSlaSettingsRoutes(app: FastifyInstance, db: Db): void {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const repo = slaSettingsRepo(db);

  r.get('/sla-settings', { schema: { response: { 200: settingsResponse } } }, async (req) => {
    return present(await repo.getOrCreate(req.orgId));
  });

  r.put('/sla-settings', { schema: { body: putBody, response: { 200: settingsResponse } } }, async (req) => {
    await repo.getOrCreate(req.orgId);
    const body = req.body;
    const patch: Record<string, unknown> = { updatedBy: req.user.id };
    if (body.enabled !== undefined) patch.enabled = body.enabled;
    if (body.targets !== undefined) patch.targets = body.targets;
    const updated = await repo.update(req.orgId, patch);
    void recordAudit(db, { orgId: req.orgId, actorId: req.user.id, actorEmail: req.user.email, action: 'settings.sla.updated', metadata: safeMeta(req.body as Record<string, unknown>, ['enabled', 'inboundEnabled', 'autoCreateUsers', 'acceptNewSenders']), ip: req.ip });
    return present(updated);
  });
}
