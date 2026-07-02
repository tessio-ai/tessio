// SPDX-License-Identifier: AGPL-3.0-only

import { and, eq } from 'drizzle-orm';
import { teamSchemas } from '../schema';
import type { Db } from '../client';

export function teamSchemasRepo(db: Db) {
  return {
    async listByTeam(teamId: string) {
      return db.select().from(teamSchemas).where(eq(teamSchemas.teamId, teamId));
    },
    async listBySchema(schemaId: string) {
      return db.select().from(teamSchemas).where(eq(teamSchemas.schemaId, schemaId));
    },
    async add(teamId: string, schemaId: string) {
      const rows = await db.insert(teamSchemas).values({ teamId, schemaId }).onConflictDoNothing().returning();
      return rows[0];
    },
    async remove(teamId: string, schemaId: string) {
      await db.delete(teamSchemas).where(and(eq(teamSchemas.teamId, teamId), eq(teamSchemas.schemaId, schemaId)));
    },
  };
}
