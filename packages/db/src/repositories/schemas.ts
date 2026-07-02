// SPDX-License-Identifier: AGPL-3.0-only

import { and, eq, sql, type SQL } from 'drizzle-orm';
import { schemas } from '../schema';
import type { Db } from '../client';
import type { SchemaDefinition } from '@tessio/shared';

type SchemaKind = 'ticket' | 'asset' | 'kb_article' | 'form';
type SchemaStatus = 'draft' | 'published' | 'archived';

export interface SchemaListFilter {
  kind?: SchemaKind;
  status?: SchemaStatus;
}

/** Read-only access to record-type definitions (the `schemas` table), org-scoped. */
export function schemasRepo(db: Db) {
  return {
    async list(orgId: string, filter: SchemaListFilter = {}) {
      const conditions: SQL[] = [eq(schemas.orgId, orgId)];
      if (filter.kind) conditions.push(eq(schemas.kind, filter.kind));
      if (filter.status) conditions.push(eq(schemas.status, filter.status));
      return db
        .select()
        .from(schemas)
        .where(and(...conditions));
    },

    async getById(orgId: string, id: string) {
      const rows = await db
        .select()
        .from(schemas)
        .where(and(eq(schemas.orgId, orgId), eq(schemas.id, id)));
      return rows[0];
    },

    /**
     * Replace a schema's field definition IN PLACE and bump its version.
     *
     * NOTE: this mutates the single `schemas` row (one row per orgId+kind+key) — it
     * does NOT snapshot prior versions as separate rows. Tickets keep their stored
     * `data` and their pinned `schemaVersion` integer, but the *old definition text*
     * is not recoverable after a bump. Consumers (e.g. ticket rendering) must read
     * the current definition, not assume a historical version's shape. If true
     * version snapshotting is needed later, insert a new (kind,key,version) row
     * instead of mutating — the `unique(orgId, kind, key, version)` constraint already
     * supports that and would otherwise reject a colliding in-place bump.
     */
    async updateDefinition(orgId: string, id: string, definition: SchemaDefinition) {
      const rows = await db
        .update(schemas)
        .set({ definition, version: sql`${schemas.version} + 1` })
        .where(and(eq(schemas.orgId, orgId), eq(schemas.id, id)))
        .returning();
      return rows[0];
    },

    async update(orgId: string, id: string, patch: { name?: string; key?: string }) {
      const rows = await db
        .update(schemas)
        .set(patch)
        .where(and(eq(schemas.orgId, orgId), eq(schemas.id, id)))
        .returning();
      return rows[0];
    },

    async create(values: typeof schemas.$inferInsert) {
      const rows = await db.insert(schemas).values(values).returning();
      return rows[0];
    },
  };
}
