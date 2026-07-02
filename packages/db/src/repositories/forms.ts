// SPDX-License-Identifier: AGPL-3.0-only

import { and, eq } from 'drizzle-orm';
import { forms } from '../schema';
import type { Db } from '../client';

type FormInsert = typeof forms.$inferInsert;

export function formsRepo(db: Db) {
  return {
    async create(values: FormInsert) {
      const rows = await db.insert(forms).values(values).returning();
      return rows[0];
    },
    async findById(orgId: string, id: string) {
      const rows = await db.select().from(forms).where(and(eq(forms.orgId, orgId), eq(forms.id, id)));
      return rows[0];
    },
    async findByKey(orgId: string, key: string) {
      const rows = await db.select().from(forms).where(and(eq(forms.orgId, orgId), eq(forms.key, key)));
      return rows[0];
    },
    async list(orgId: string, filter: { status?: 'draft' | 'published' | 'archived' } = {}) {
      const conds = [eq(forms.orgId, orgId)];
      if (filter.status) conds.push(eq(forms.status, filter.status));
      return db.select().from(forms).where(and(...conds));
    },
    async listPublished(orgId: string) {
      return db.select().from(forms).where(and(eq(forms.orgId, orgId), eq(forms.status, 'published')));
    },
    async update(orgId: string, id: string, patch: Partial<FormInsert>) {
      const rows = await db.update(forms).set({ ...patch, updatedAt: new Date() }).where(and(eq(forms.orgId, orgId), eq(forms.id, id))).returning();
      return rows[0];
    },
    async archive(orgId: string, id: string) {
      const rows = await db.update(forms).set({ status: 'archived', updatedAt: new Date() }).where(and(eq(forms.orgId, orgId), eq(forms.id, id))).returning();
      return rows[0];
    },
    /** Name of the first non-archived form on `schemaId` whose definition references `fieldKey`, else null. */
    async fieldReferencedByForm(orgId: string, schemaId: string, fieldKey: string): Promise<string | null> {
      const rows = await db.select().from(forms).where(and(eq(forms.orgId, orgId), eq(forms.targetSchemaId, schemaId)));
      for (const f of rows) {
        if (f.status === 'archived') continue;
        const refs = (f.definition?.sections ?? []).flatMap((s) => s.fields.map((x) => x.fieldKey));
        if (refs.includes(fieldKey)) return f.name;
      }
      return null;
    },
  };
}
