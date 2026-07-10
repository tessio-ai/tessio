// SPDX-License-Identifier: AGPL-3.0-only

import { asc, eq } from 'drizzle-orm';
import { loginSettings, orgs } from '../schema';
import type { Db } from '../client';

type LoginSettingsInsert = typeof loginSettings.$inferInsert;

export function loginSettingsRepo(db: Db) {
  return {
    /** Return the org's settings, lazily creating a default row on first access. */
    async getOrCreate(orgId: string) {
      const existing = await db.select().from(loginSettings).where(eq(loginSettings.orgId, orgId));
      if (existing[0]) return existing[0];
      const rows = await db.insert(loginSettings).values({ orgId }).onConflictDoNothing().returning();
      if (rows[0]) return rows[0];
      // lost a create race — re-read
      const reread = await db.select().from(loginSettings).where(eq(loginSettings.orgId, orgId));
      return reread[0];
    },
    async update(orgId: string, patch: Partial<LoginSettingsInsert>) {
      const rows = await db.update(loginSettings).set({ ...patch, updatedAt: new Date() }).where(eq(loginSettings.orgId, orgId)).returning();
      return rows[0];
    },
    /**
     * Read-only lookup for the pre-auth sign-in screen. Community runs a single
     * org (slug "default"); fall back to the oldest org so a renamed slug still
     * resolves. Never inserts — this is reachable without a session.
     */
    async findForDefaultOrg() {
      const [bySlug] = await db.select().from(orgs).where(eq(orgs.slug, 'default'));
      const org = bySlug ?? (await db.select().from(orgs).orderBy(asc(orgs.createdAt)).limit(1))[0];
      if (!org) return undefined;
      const rows = await db.select().from(loginSettings).where(eq(loginSettings.orgId, org.id));
      return rows[0];
    },
  };
}
