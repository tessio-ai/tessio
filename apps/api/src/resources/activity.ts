// SPDX-License-Identifier: AGPL-3.0-only

import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Db, RecordKind } from '@tessio/db';
import { listActivity, ticketsRepo } from '@tessio/db';
import { notFound } from '../errors';

const parentParam = z.object({ id: z.string().uuid() });
const activityOut = z.object({
  id: z.string(),
  actorId: z.string().nullable(),
  eventType: z.string(),
  changes: z.record(z.unknown()).nullable().optional(),
  createdAt: z.coerce.string(),
});

/** Register GET /:resource/:id/activity for one record kind. */
export function registerActivityRoutes(app: FastifyInstance, db: Db, segment: string, kind: RecordKind): void {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const ticketScoped = kind === 'ticket';

  async function assertTicketAccess(orgId: string, recordId: string, user: { id: string; role: string }) {
    if (!ticketScoped || user.role === 'admin') return;
    // Agents are constrained to team-visible tickets; requesters to their own.
    const row = await ticketsRepo(db).getById(orgId, recordId, { userId: user.id, role: user.role });
    if (!row) throw notFound(`tickets ${recordId} not found`);
    if (user.role === 'requester' && row.requesterId !== user.id) throw notFound(`tickets ${recordId} not found`);
  }

  r.get(
    `/${segment}/:id/activity`,
    { schema: { params: parentParam, response: { 200: z.array(activityOut) } } },
    async (req) => {
      const { id } = req.params as z.infer<typeof parentParam>;
      await assertTicketAccess(req.orgId, id, req.user);
      const rows = await listActivity(db, req.orgId, kind, id);
      return rows.map((row) => ({
        id: row.id,
        actorId: row.actorId,
        eventType: row.eventType,
        changes: row.changes,
        createdAt: row.createdAt.toISOString(),
      }));
    },
  );
}
