// SPDX-License-Identifier: AGPL-3.0-only

import { pgTable, uuid, integer, text, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { orgs } from './orgs';
import { users } from './users';
import { tickets } from './tickets';

/**
 * One satisfaction survey per ticket. A row is created when the survey is
 * sent (rating null = awaiting response) and filled in when the requester
 * responds — so response rate is `count(rating) / count(*)`.
 */
export const csatResponses = pgTable(
  'csat_responses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => orgs.id),
    ticketId: uuid('ticket_id').notNull().references(() => tickets.id),
    requesterId: uuid('requester_id').references(() => users.id),
    rating: integer('rating'),
    comment: text('comment'),
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
    respondedAt: timestamp('responded_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('csat_responses_ticket_uq').on(t.ticketId),
    index('csat_responses_org_idx').on(t.orgId),
    index('csat_responses_org_responded_idx').on(t.orgId, t.respondedAt),
  ],
);
