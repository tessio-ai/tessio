// SPDX-License-Identifier: AGPL-3.0-only

import { eq } from 'drizzle-orm';
import { csatSettings } from '../schema';
import type { Db } from '../client';

type CsatSettingsInsert = typeof csatSettings.$inferInsert;

export function csatSettingsRepo(db: Db) {
  return {
    /** Return the org's row, lazily creating a disabled default on first access. */
    async getOrCreate(orgId: string) {
      const existing = await db.select().from(csatSettings).where(eq(csatSettings.orgId, orgId));
      if (existing[0]) return existing[0];
      const rows = await db.insert(csatSettings).values({ orgId }).onConflictDoNothing().returning();
      if (rows[0]) return rows[0];
      // lost a create race — re-read
      const reread = await db.select().from(csatSettings).where(eq(csatSettings.orgId, orgId));
      return reread[0];
    },
    async update(orgId: string, patch: Partial<CsatSettingsInsert>) {
      const rows = await db
        .update(csatSettings)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(csatSettings.orgId, orgId))
        .returning();
      return rows[0];
    },
  };
}
