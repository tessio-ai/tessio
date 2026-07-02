// SPDX-License-Identifier: LicenseRef-Tessio-Commercial

import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { auditRepo } from '@tessio/db';
import type { EnterpriseContext } from '@tessio/entitlements';

const querySchema = z.object({
  action: z.string().optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
  before: z.string().optional(),
});

const itemSchema = z.object({
  id: z.string(),
  actorEmail: z.string(),
  action: z.string(),
  targetType: z.string().nullable(),
  targetId: z.string().nullable(),
  metadata: z.record(z.unknown()),
  ip: z.string().nullable(),
  createdAt: z.string(),
});

const responseSchema = z.object({
  items: z.array(itemSchema),
  nextBefore: z.string().nullable(),
});

/**
 * Admin-only audit-log VIEWER (Enterprise). The audit *writer* (`recordAudit`)
 * stays in core so the Community build still records events; this read surface
 * is the gated enterprise feature. Caller must be guarded by requireRole('admin').
 */
export function registerAuditRoutes(app: FastifyInstance, ctx: EnterpriseContext): void {
  const { db } = ctx;
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get(
    '/audit-log',
    { schema: { querystring: querySchema, response: { 200: responseSchema } } },
    async (req) => {
      const q = req.query;
      // Opaque keyset cursor: "<createdAt ISO>|<id>".
      let before: { createdAt: Date; id: string } | undefined;
      if (q.before) {
        const sep = q.before.lastIndexOf('|');
        if (sep > 0) {
          const at = new Date(q.before.slice(0, sep));
          const id = q.before.slice(sep + 1);
          if (!Number.isNaN(at.getTime()) && id) before = { createdAt: at, id };
        }
      }
      const { items, nextBefore } = await auditRepo(db).list(req.orgId, {
        action: q.action,
        limit: q.limit,
        before,
      });
      return {
        items: items.map((row) => ({
          id: row.id,
          actorEmail: row.actorEmail,
          action: row.action,
          targetType: row.targetType,
          targetId: row.targetId,
          metadata: row.metadata,
          ip: row.ip,
          createdAt: row.createdAt.toISOString(),
        })),
        nextBefore: nextBefore ? `${nextBefore.createdAt.toISOString()}|${nextBefore.id}` : null,
      };
    },
  );
}
