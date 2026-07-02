// SPDX-License-Identifier: AGPL-3.0-only

import { and, eq, lt, or, desc } from 'drizzle-orm';
import { auditLog } from '../schema';
import type { Db } from '../client';
type AuditInsert = typeof auditLog.$inferInsert;

/** Keyset cursor: page by (createdAt, id) so ties on createdAt aren't dropped/duplicated. */
export interface AuditCursor { createdAt: Date; id: string; }

export function auditRepo(db: Db) {
  return {
    async record(entry: Omit<AuditInsert, 'id' | 'createdAt'>) {
      await db.insert(auditLog).values(entry);
    },
    async list(orgId: string, opts: { action?: string; limit?: number; before?: AuditCursor } = {}) {
      const limit = Math.min(opts.limit ?? 50, 200);
      const conds = [eq(auditLog.orgId, orgId)];
      if (opts.action) conds.push(eq(auditLog.action, opts.action));
      if (opts.before) {
        const c = opts.before;
        // (createdAt < cur) OR (createdAt = cur AND id < curId) — strict, tie-broken on id.
        conds.push(or(lt(auditLog.createdAt, c.createdAt), and(eq(auditLog.createdAt, c.createdAt), lt(auditLog.id, c.id)))!);
      }
      const rows = await db
        .select().from(auditLog).where(and(...conds))
        .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
        .limit(limit + 1);
      const items = rows.slice(0, limit);
      const last = items[items.length - 1];
      const nextBefore: AuditCursor | null = rows.length > limit && last ? { createdAt: last.createdAt, id: last.id } : null;
      return { items, nextBefore };
    },
  };
}
