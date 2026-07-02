// SPDX-License-Identifier: AGPL-3.0-only

import { eq } from 'drizzle-orm';
import { ssoSettings } from '../schema';
import type { Db } from '../client';

type SsoSettingsInsert = typeof ssoSettings.$inferInsert;

export function ssoSettingsRepo(db: Db) {
  return {
    async get() {
      const rows = await db.select().from(ssoSettings).where(eq(ssoSettings.id, true));
      if (rows[0]) return rows[0];
      const ins = await db
        .insert(ssoSettings)
        .values({ id: true })
        .onConflictDoNothing()
        .returning();
      if (ins[0]) return ins[0];
      // lost a create race — re-read
      const re = await db.select().from(ssoSettings).where(eq(ssoSettings.id, true));
      return re[0];
    },
    async update(patch: Partial<SsoSettingsInsert>) {
      const rows = await db
        .update(ssoSettings)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(ssoSettings.id, true))
        .returning();
      return rows[0];
    },
  };
}
