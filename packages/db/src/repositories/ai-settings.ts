// SPDX-License-Identifier: AGPL-3.0-only

import { eq } from 'drizzle-orm';
import { aiSettings } from '../schema';
import type { Db } from '../client';

type AiSettingsInsert = typeof aiSettings.$inferInsert;

export function aiSettingsRepo(db: Db) {
  return {
    /** Return the org's row, lazily creating a disabled default on first access. */
    async getOrCreate(orgId: string) {
      const existing = await db.select().from(aiSettings).where(eq(aiSettings.orgId, orgId));
      if (existing[0]) return existing[0];
      const rows = await db.insert(aiSettings).values({ orgId }).onConflictDoNothing().returning();
      if (rows[0]) return rows[0];
      // lost a create race — re-read
      const reread = await db.select().from(aiSettings).where(eq(aiSettings.orgId, orgId));
      return reread[0];
    },
    async update(orgId: string, patch: Partial<AiSettingsInsert>) {
      const rows = await db
        .update(aiSettings)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(aiSettings.orgId, orgId))
        .returning();
      return rows[0];
    },
  };
}
