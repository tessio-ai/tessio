// SPDX-License-Identifier: AGPL-3.0-only

import { randomBytes } from 'node:crypto';
import { and, eq, gt, lt } from 'drizzle-orm';
import { sessions, users } from '../schema';
import type { Db } from '../client';

const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function sessionsRepo(db: Db) {
  return {
    async create(opts: { userId: string; orgId: string; ttlMs?: number }) {
      const id = randomBytes(32).toString('base64url');
      const expiresAt = new Date(Date.now() + (opts.ttlMs ?? DEFAULT_TTL_MS));
      const rows = await db.insert(sessions).values({ id, userId: opts.userId, orgId: opts.orgId, expiresAt }).returning();
      return rows[0];
    },
    /** Returns `{ session, user }` only if not expired and the user is active. */
    async findValid(id: string) {
      const rows = await db
        .select({ session: sessions, user: users })
        .from(sessions)
        .innerJoin(users, eq(sessions.userId, users.id))
        .where(and(eq(sessions.id, id), gt(sessions.expiresAt, new Date()), eq(users.status, 'active')));
      return rows[0];
    },
    async delete(id: string) {
      await db.delete(sessions).where(eq(sessions.id, id));
    },
    async deleteAllForUser(userId: string) {
      await db.delete(sessions).where(eq(sessions.userId, userId));
    },
    async deleteExpired() {
      await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
    },
  };
}
