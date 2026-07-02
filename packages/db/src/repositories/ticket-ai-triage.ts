// SPDX-License-Identifier: AGPL-3.0-only

import { eq } from 'drizzle-orm';
import { ticketAiTriage } from '../schema';
import type { Db } from '../client';

export interface TriageUpsert {
  ticketId: string;
  category: string | null;
  priority: string | null;
  suggestedAssigneeId: string | null;
  confidence: number | null;
  reasoning: string | null;
}

export function ticketAiTriageRepo(db: Db) {
  return {
    async get(ticketId: string) {
      const rows = await db.select().from(ticketAiTriage).where(eq(ticketAiTriage.ticketId, ticketId));
      return rows[0];
    },
    async upsert(input: TriageUpsert) {
      const now = new Date();
      const rows = await db
        .insert(ticketAiTriage)
        .values({ ...input, triagedAt: now })
        .onConflictDoUpdate({
          target: ticketAiTriage.ticketId,
          set: {
            category: input.category,
            priority: input.priority,
            suggestedAssigneeId: input.suggestedAssigneeId,
            confidence: input.confidence,
            reasoning: input.reasoning,
            triagedAt: now,
          },
        })
        .returning();
      return rows[0];
    },
  };
}
