// SPDX-License-Identifier: AGPL-3.0-only

import { eq } from 'drizzle-orm';
import { emailSettings } from '../schema';
import type { Db } from '../client';

type EmailSettingsInsert = typeof emailSettings.$inferInsert;

export function emailSettingsRepo(db: Db) {
  return {
    /** Return the org's row, lazily creating a disabled default on first access. */
    async getOrCreate(orgId: string) {
      const existing = await db.select().from(emailSettings).where(eq(emailSettings.orgId, orgId));
      if (existing[0]) return existing[0];
      const rows = await db.insert(emailSettings).values({ orgId }).onConflictDoNothing().returning();
      if (rows[0]) return rows[0];
      // lost a create race — re-read
      const reread = await db.select().from(emailSettings).where(eq(emailSettings.orgId, orgId));
      return reread[0];
    },
    async update(orgId: string, patch: Partial<EmailSettingsInsert>) {
      const rows = await db
        .update(emailSettings)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(emailSettings.orgId, orgId))
        .returning();
      return rows[0];
    },
    /** List org ids that have IMAP inbound polling enabled. */
    async listInboundOrgs(): Promise<string[]> {
      const rows = await db
        .select({ orgId: emailSettings.orgId })
        .from(emailSettings)
        .where(eq(emailSettings.inboundEnabled, true));
      return rows.map((r) => r.orgId);
    },
  };
}
