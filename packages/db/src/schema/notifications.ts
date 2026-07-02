// SPDX-License-Identifier: AGPL-3.0-only

import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { orgs } from './orgs';
import { users } from './users';
import { tickets } from './tickets';

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => orgs.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  ticketId: uuid('ticket_id').references(() => tickets.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // 'assigned' | 'reply' | 'status' | 'sla'
  title: text('title').notNull(),
  snippet: text('snippet').notNull().default(''),
  readAt: timestamp('read_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('notifications_user_idx').on(t.userId, t.readAt)]);
