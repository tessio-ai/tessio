// SPDX-License-Identifier: AGPL-3.0-only

import { and, eq } from 'drizzle-orm';
import type { ReportDefinition } from '@tessio/shared';
import { reports } from '../schema';
import type { Db } from '../client';

export interface NewReport {
  orgId: string;
  name: string;
  description?: string | null;
  definition: ReportDefinition;
  ownerId?: string | null;
}

export interface ReportPatch {
  name?: string;
  description?: string | null;
  definition?: ReportDefinition;
}

export function reportsRepo(db: Db) {
  return {
    async list(orgId: string) {
      return db
        .select({
          id: reports.id,
          name: reports.name,
          description: reports.description,
          definition: reports.definition,
          updatedAt: reports.updatedAt,
        })
        .from(reports)
        .where(eq(reports.orgId, orgId));
    },

    async get(orgId: string, id: string) {
      const rows = await db
        .select()
        .from(reports)
        .where(and(eq(reports.orgId, orgId), eq(reports.id, id)));
      return rows[0];
    },

    async create(values: NewReport) {
      const rows = await db.insert(reports).values(values).returning();
      return rows[0];
    },

    async update(orgId: string, id: string, patch: ReportPatch) {
      const rows = await db
        .update(reports)
        .set({ ...patch, updatedAt: new Date() })
        .where(and(eq(reports.orgId, orgId), eq(reports.id, id)))
        .returning();
      return rows[0];
    },

    async remove(orgId: string, id: string) {
      await db.delete(reports).where(and(eq(reports.orgId, orgId), eq(reports.id, id)));
    },
  };
}
