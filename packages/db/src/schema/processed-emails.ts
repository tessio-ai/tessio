// SPDX-License-Identifier: AGPL-3.0-only

import { pgTable, uuid, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { orgs } from './orgs';

export const processedEmails = pgTable('processed_emails', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => orgs.id),
  messageId: text('message_id').notNull(),
  ticketId: uuid('ticket_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique('processed_emails_org_msg_key').on(t.orgId, t.messageId)]);
