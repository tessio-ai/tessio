// SPDX-License-Identifier: AGPL-3.0-only

import { and, eq, desc, isNull, sql } from 'drizzle-orm';
import { notifications } from '../schema';
import type { Db } from '../client';

type NotificationInsert = typeof notifications.$inferInsert;

export function notificationsRepo(db: Db) {
  return {
    async create(values: NotificationInsert) {
      const rows = await db.insert(notifications).values(values).returning();
      return rows[0];
    },
    async createMany(values: NotificationInsert[]) {
      if (values.length === 0) return [];
      return db.insert(notifications).values(values).returning();
    },
    async list(orgId: string, userId: string, limit = 30) {
      return db
        .select()
        .from(notifications)
        .where(and(eq(notifications.orgId, orgId), eq(notifications.userId, userId)))
        .orderBy(desc(notifications.createdAt))
        .limit(limit);
    },
    async unreadCount(orgId: string, userId: string): Promise<number> {
      const [row] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(notifications)
        .where(
          and(
            eq(notifications.orgId, orgId),
            eq(notifications.userId, userId),
            isNull(notifications.readAt),
          ),
        );
      return row?.n ?? 0;
    },
    async markRead(orgId: string, userId: string, id: string) {
      await db
        .update(notifications)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(notifications.orgId, orgId),
            eq(notifications.userId, userId),
            eq(notifications.id, id),
          ),
        );
    },
    async markAllRead(orgId: string, userId: string) {
      await db
        .update(notifications)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(notifications.orgId, orgId),
            eq(notifications.userId, userId),
            isNull(notifications.readAt),
          ),
        );
    },
  };
}
