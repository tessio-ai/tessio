// SPDX-License-Identifier: AGPL-3.0-only

import { eq } from 'drizzle-orm';
import { portalSettings } from '../schema';
import type { Db } from '../client';

type PortalSettingsInsert = typeof portalSettings.$inferInsert;

export function portalSettingsRepo(db: Db) {
  return {
    /** Return the org's settings, lazily creating a default row on first access. */
    async getOrCreate(orgId: string) {
      const existing = await db.select().from(portalSettings).where(eq(portalSettings.orgId, orgId));
      if (existing[0]) return existing[0];
      const rows = await db.insert(portalSettings).values({ orgId }).onConflictDoNothing().returning();
      if (rows[0]) return rows[0];
      // lost a create race — re-read
      const reread = await db.select().from(portalSettings).where(eq(portalSettings.orgId, orgId));
      return reread[0];
    },
    async update(orgId: string, patch: Partial<PortalSettingsInsert>) {
      const rows = await db.update(portalSettings).set({ ...patch, updatedAt: new Date() }).where(eq(portalSettings.orgId, orgId)).returning();
      return rows[0];
    },
  };
}
