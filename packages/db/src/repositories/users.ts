// SPDX-License-Identifier: AGPL-3.0-only

import { and, eq, inArray, sql } from 'drizzle-orm';
import { users } from '../schema';
import type { Db } from '../client';
import { BILLABLE_ROLES, type NotificationPrefs } from '@tessio/shared';

type UserInsert = typeof users.$inferInsert;

export function usersRepo(db: Db) {
  return {
    async create(values: UserInsert) {
      const rows = await db
        .insert(users)
        .values({ ...values, email: values.email.toLowerCase() })
        .returning();
      return rows[0];
    },
    async findByEmail(orgId: string, email: string) {
      const rows = await db
        .select()
        .from(users)
        .where(and(eq(users.orgId, orgId), eq(users.email, email.toLowerCase())));
      return rows[0];
    },
    /**
     * Community single-org login: resolve by email alone. `.limit(1)` keeps this
     * deterministic; email uniqueness is only guaranteed per-org, so this assumes
     * the single-default-org community deployment.
     */
    async findByEmailGlobal(email: string) {
      const rows = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
      return rows[0];
    },
    async findById(id: string) {
      const rows = await db.select().from(users).where(eq(users.id, id));
      return rows[0];
    },
    async list(orgId: string) {
      return db.select().from(users).where(eq(users.orgId, orgId));
    },
    /** Active billable seats in use: admins + agents (requesters are free). */
    async countBillable(orgId: string) {
      const rows = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(users)
        .where(and(eq(users.orgId, orgId), eq(users.status, 'active'), inArray(users.role, [...BILLABLE_ROLES])));
      return rows[0]?.count ?? 0;
    },
    async setStatus(id: string, status: 'active' | 'disabled') {
      const rows = await db.update(users).set({ status, updatedAt: new Date() }).where(eq(users.id, id)).returning();
      return rows[0];
    },
    async setRole(id: string, role: 'admin' | 'agent' | 'requester') {
      const rows = await db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, id)).returning();
      return rows[0];
    },
    async updateNotificationPrefs(orgId: string, userId: string, prefs: NotificationPrefs) {
      const rows = await db
        .update(users)
        .set({ notificationPrefs: prefs, updatedAt: new Date() })
        .where(and(eq(users.orgId, orgId), eq(users.id, userId)))
        .returning();
      return rows[0];
    },
  };
}
