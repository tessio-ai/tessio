// SPDX-License-Identifier: AGPL-3.0-only

import { and, eq } from 'drizzle-orm';
import { processedEmails } from '../schema';
import type { Db } from '../client';

export function processedEmailsRepo(db: Db) {
  return {
    /** Insert; returns false if (orgId,messageId) already existed (i.e. already processed). */
    async claim(orgId: string, messageId: string, ticketId: string | null): Promise<boolean> {
      const rows = await db
        .insert(processedEmails)
        .values({ orgId, messageId, ticketId })
        .onConflictDoNothing()
        .returning();
      return rows.length > 0;
    },
    /** Back-fill the resolved ticket on an already-claimed message (audit link email→ticket). */
    async linkTicket(orgId: string, messageId: string, ticketId: string): Promise<void> {
      await db
        .update(processedEmails)
        .set({ ticketId })
        .where(and(eq(processedEmails.orgId, orgId), eq(processedEmails.messageId, messageId)));
    },
    async wasProcessed(orgId: string, messageId: string): Promise<boolean> {
      const rows = await db
        .select({ id: processedEmails.id })
        .from(processedEmails)
        .where(and(eq(processedEmails.orgId, orgId), eq(processedEmails.messageId, messageId)));
      return rows.length > 0;
    },
  };
}
