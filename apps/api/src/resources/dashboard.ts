// SPDX-License-Identifier: AGPL-3.0-only

import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Db } from '@tessio/db';
import { dashboardRepo } from '@tessio/db';

const dashboardResponse = z.object({
  myOpen: z.number(),
  unassigned: z.number(),
  dueToday: z.number(),
  breaching: z.number(),
  openByStatus: z.array(z.object({ status: z.string(), count: z.number() })),
  series: z.array(z.object({ date: z.string(), created: z.number(), resolved: z.number() })),
  today: z.object({ created: z.number(), resolved: z.number(), triaged: z.number() }),
  tess: z.object({ enabled: z.boolean(), triaged: z.number(), indexed: z.number(), flagged: z.number() }),
  recentTess: z.array(
    z.object({
      ticketId: z.string(),
      number: z.number().nullable(),
      title: z.string(),
      category: z.string().nullable(),
      priority: z.string().nullable(),
      confidence: z.number().nullable(),
      at: z.string(),
    }),
  ),
});

/** Agent/admin dashboard aggregates (org- and team-scoped to the caller). */
export function registerDashboardRoutes(app: FastifyInstance, db: Db): void {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get('/dashboard', { schema: { response: { 200: dashboardResponse } } }, async (req) => {
    return dashboardRepo(db).stats(req.orgId, {
      userId: req.user.id,
      scope: { userId: req.user.id, role: req.user.role },
    });
  });
}
