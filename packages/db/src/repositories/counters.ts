// SPDX-License-Identifier: AGPL-3.0-only

import { sql } from 'drizzle-orm';
import { orgCounters } from '../schema';
import type { Db } from '../client';

/**
 * Atomically increment and return the next value for (org, entity).
 * Single round-trip upsert — safe under concurrency without explicit locks.
 */
export async function assignNextNumber(db: Db, orgId: string, entity: string): Promise<number> {
  const rows = await db
    .insert(orgCounters)
    .values({ orgId, entity, value: 1 })
    .onConflictDoUpdate({
      target: [orgCounters.orgId, orgCounters.entity],
      set: { value: sql`${orgCounters.value} + 1` },
    })
    .returning({ value: orgCounters.value });
  return rows[0].value;
}
