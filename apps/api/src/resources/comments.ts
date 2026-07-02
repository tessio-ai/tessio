// SPDX-License-Identifier: AGPL-3.0-only

import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Db, RecordKind } from '@tessio/db';
import { addComment, listComments, ticketsRepo } from '@tessio/db';
import { recordResponse } from './schemas';
import { notFound } from '../errors';
import type { WorkflowProducers } from '../workflows/producer';

const parentParam = z.object({ id: z.string().uuid() });
const commentBody = z.object({ body: z.string().min(1), internal: z.boolean().optional() });

/** Register POST/GET /:resource/:id/comments for one record kind at a URL segment. */
export function registerCommentRoutes(
  app: FastifyInstance,
  db: Db,
  segment: string,
  kind: RecordKind,
  workflows?: WorkflowProducers,
): void {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const ticketScoped = kind === 'ticket';

  async function assertTicketAccess(orgId: string, recordId: string, user: { id: string; role: string }) {
    if (!ticketScoped || user.role !== 'requester') return;
    const row = await ticketsRepo(db).getById(orgId, recordId);
    if (!row || row.requesterId !== user.id) throw notFound(`tickets ${recordId} not found`);
  }

  r.post(
    `/${segment}/:id/comments`,
    { schema: { params: parentParam, body: commentBody, response: { 201: recordResponse } } },
    async (req, reply) => {
      const { id } = req.params as z.infer<typeof parentParam>;
      await assertTicketAccess(req.orgId, id, req.user);
      const b = req.body as z.infer<typeof commentBody>;
      const internal = req.user.role === 'requester' ? false : b.internal;
      const created = await addComment(db, {
        orgId: req.orgId,
        recordType: kind,
        recordId: id,
        body: b.body,
        internal,
        authorId: req.user.id,
      });
      if (ticketScoped) {
        void workflows?.publishNotification(db, req.orgId, {
          eventType: 'commented',
          recordId: id,
          actorId: req.user.id,
          internal: created.internal === true,
        });
        if (created.internal !== true && req.user.role !== 'requester') {
          await ticketsRepo(db).markFirstResponded(req.orgId, id, new Date());
        }
      }
      reply.code(201);
      return created;
    },
  );

  r.get(
    `/${segment}/:id/comments`,
    { schema: { params: parentParam, response: { 200: z.array(recordResponse) } } },
    async (req) => {
      const { id } = req.params as z.infer<typeof parentParam>;
      await assertTicketAccess(req.orgId, id, req.user);
      return listComments(db, req.orgId, kind, id, { excludeInternal: req.user.role === 'requester' });
    },
  );
}
