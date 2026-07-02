// SPDX-License-Identifier: AGPL-3.0-only

import { eq } from 'drizzle-orm';
import { slaSettings } from '../schema';
import type { Db } from '../client';

type SlaSettingsInsert = typeof slaSettings.$inferInsert;

export function slaSettingsRepo(db: Db) {
  return {
    /** Return the org's row, lazily creating a disabled default on first access. */
    async getOrCreate(orgId: string) {
      const existing = await db.select().from(slaSettings).where(eq(slaSettings.orgId, orgId));
      if (existing[0]) return existing[0];
      const rows = await db.insert(slaSettings).values({ orgId }).onConflictDoNothing().returning();
      if (rows[0]) return rows[0];
      // lost a create race — re-read
      const reread = await db.select().from(slaSettings).where(eq(slaSettings.orgId, orgId));
      return reread[0];
    },
    async update(orgId: string, patch: Partial<SlaSettingsInsert>) {
      const rows = await db
        .update(slaSettings)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(slaSettings.orgId, orgId))
        .returning();
      return rows[0];
    },
  };
}
