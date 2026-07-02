// SPDX-License-Identifier: AGPL-3.0-only

import { and, eq, inArray } from 'drizzle-orm';
import { teamMembers } from '../schema';
import type { Db } from '../client';

export function teamMembersRepo(db: Db) {
  return {
    async listByTeam(teamId: string) {
      return db.select().from(teamMembers).where(eq(teamMembers.teamId, teamId));
    },
    async listByUser(userId: string) {
      return db.select().from(teamMembers).where(eq(teamMembers.userId, userId));
    },
    async listByUsers(userIds: string[]) {
      if (!userIds.length) return [];
      return db.select().from(teamMembers).where(inArray(teamMembers.userId, userIds));
    },
    async add(teamId: string, userId: string) {
      const rows = await db.insert(teamMembers).values({ teamId, userId }).onConflictDoNothing().returning();
      return rows[0];
    },
    async remove(teamId: string, userId: string) {
      await db.delete(teamMembers).where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)));
    },
  };
}
