// SPDX-License-Identifier: AGPL-3.0-only

import { eq } from 'drizzle-orm';
import { orgs } from '../schema';
import type { Db } from '../client';

export function orgsRepo(db: Db) {
  return {
    async findById(id: string) {
      const rows = await db.select().from(orgs).where(eq(orgs.id, id));
      return rows[0];
    },
    async update(id: string, patch: { name?: string }) {
      const rows = await db.update(orgs).set(patch).where(eq(orgs.id, id)).returning();
      return rows[0];
    },
  };
}
