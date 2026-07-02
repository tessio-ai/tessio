// SPDX-License-Identifier: AGPL-3.0-only

import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Db } from '@tessio/db';
import { notificationsRepo } from '@tessio/db';

const idParam = z.object({ id: z.string().uuid() });

const notificationItem = z.object({
  id: z.string(),
  orgId: z.string(),
  userId: z.string(),
  ticketId: z.string().nullable(),
  type: z.string(),
  title: z.string(),
  snippet: z.string(),
  readAt: z.string().nullable(),
  createdAt: z.string(),
});

const listResponse = z.object({
  items: z.array(notificationItem),
  unreadCount: z.number(),
});

function presentItem(row: {
  id: string;
  orgId: string;
  userId: string;
  ticketId: string | null;
  type: string;
  title: string;
  snippet: string;
  readAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    orgId: row.orgId,
    userId: row.userId,
    ticketId: row.ticketId ?? null,
    type: row.type,
    title: row.title,
    snippet: row.snippet,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Any authenticated user — scoped to req.user.id. */
export function registerNotificationsRoutes(app: FastifyInstance, db: Db): void {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const repo = notificationsRepo(db);

  r.get('/notifications', { schema: { response: { 200: listResponse } } }, async (req) => {
    const [items, unreadCount] = await Promise.all([
      repo.list(req.orgId, req.user.id, 30),
      repo.unreadCount(req.orgId, req.user.id),
    ]);
    return { items: items.map(presentItem), unreadCount };
  });

  r.post('/notifications/read-all', { schema: { response: { 204: z.null() } } }, async (req, reply) => {
    await repo.markAllRead(req.orgId, req.user.id);
    reply.code(204);
    return null;
  });

  r.post('/notifications/:id/read', { schema: { params: idParam, response: { 204: z.null() } } }, async (req, reply) => {
    await repo.markRead(req.orgId, req.user.id, req.params.id);
    reply.code(204);
    return null;
  });
}
