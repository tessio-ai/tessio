// SPDX-License-Identifier: AGPL-3.0-only

import { and, eq } from 'drizzle-orm';
import { teams, tickets } from '../schema';
import type { Db } from '../client';

export function teamsRepo(db: Db) {
  return {
    async list(orgId: string) {
      return db.select().from(teams).where(eq(teams.orgId, orgId));
    },
    async findById(orgId: string, id: string) {
      const rows = await db.select().from(teams).where(and(eq(teams.orgId, orgId), eq(teams.id, id)));
      return rows[0];
    },
    async create(values: { orgId: string; name: string }) {
      const rows = await db.insert(teams).values(values).returning();
      return rows[0];
    },
    async rename(orgId: string, id: string, name: string) {
      const rows = await db.update(teams).set({ name, updatedAt: new Date() })
        .where(and(eq(teams.orgId, orgId), eq(teams.id, id))).returning();
      return rows[0];
    },
    async update(orgId: string, id: string, patch: { name?: string; emailAddress?: string | null; emailName?: string | null }) {
      const rows = await db.update(teams).set({ ...patch, updatedAt: new Date() })
        .where(and(eq(teams.orgId, orgId), eq(teams.id, id))).returning();
      return rows[0];
    },
    /** Un-assign the team from any tickets, then delete it. */
    async remove(orgId: string, id: string) {
      await db.update(tickets).set({ teamId: null, updatedAt: new Date() })
        .where(and(eq(tickets.orgId, orgId), eq(tickets.teamId, id)));
      await db.delete(teams).where(and(eq(teams.orgId, orgId), eq(teams.id, id)));
    },
  };
}
