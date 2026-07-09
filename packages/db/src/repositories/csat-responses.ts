// SPDX-License-Identifier: AGPL-3.0-only

import { and, eq, inArray, isNull } from 'drizzle-orm';
import { csatResponses } from '../schema';
import type { Db } from '../client';

export function csatResponsesRepo(db: Db) {
  return {
    /**
     * Record that a survey was sent for a ticket. Returns the new row, or
     * null when a survey already exists (never survey the same ticket twice).
     */
    async createSurvey(input: { orgId: string; ticketId: string; requesterId: string | null }) {
      const rows = await db.insert(csatResponses).values(input).onConflictDoNothing().returning();
      return rows[0] ?? null;
    },

    async getByTicket(orgId: string, ticketId: string) {
      const rows = await db
        .select()
        .from(csatResponses)
        .where(and(eq(csatResponses.orgId, orgId), eq(csatResponses.ticketId, ticketId)));
      return rows[0] ?? null;
    },

    /** All surveys for the given tickets (used by the portal "my requests" view). */
    async listByTickets(orgId: string, ticketIds: string[]) {
      if (ticketIds.length === 0) return [];
      return db
        .select()
        .from(csatResponses)
        .where(and(eq(csatResponses.orgId, orgId), inArray(csatResponses.ticketId, ticketIds)));
    },

    /** All of a requester's surveys (answered or not). */
    async listByRequester(orgId: string, requesterId: string) {
      return db
        .select()
        .from(csatResponses)
        .where(and(eq(csatResponses.orgId, orgId), eq(csatResponses.requesterId, requesterId)));
    },

    /**
     * Store the requester's rating. Creates the survey row on the fly when
     * none was sent (e.g. email disabled but the portal prompt is live).
     * Returns the updated row, or null when the ticket was already rated.
     */
    async submit(input: { orgId: string; ticketId: string; requesterId: string; rating: number; comment: string | null }) {
      const now = new Date();
      const inserted = await db
        .insert(csatResponses)
        .values({ ...input, respondedAt: now })
        .onConflictDoNothing()
        .returning();
      if (inserted[0]) return inserted[0];
      const updated = await db
        .update(csatResponses)
        .set({ rating: input.rating, comment: input.comment, respondedAt: now })
        .where(and(
          eq(csatResponses.orgId, input.orgId),
          eq(csatResponses.ticketId, input.ticketId),
          isNull(csatResponses.respondedAt),
        ))
        .returning();
      return updated[0] ?? null;
    },
  };
}
