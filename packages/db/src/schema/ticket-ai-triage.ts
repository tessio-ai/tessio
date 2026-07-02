// SPDX-License-Identifier: AGPL-3.0-only

import { pgTable, uuid, text, real, timestamp } from 'drizzle-orm/pg-core';
import { tickets } from './tickets';
import { users } from './users';

/** One row per ticket — Tess's triage suggestion. */
export const ticketAiTriage = pgTable('ticket_ai_triage', {
  ticketId: uuid('ticket_id').primaryKey().references(() => tickets.id, { onDelete: 'cascade' }),
  category: text('category'),
  priority: text('priority'),
  suggestedAssigneeId: uuid('suggested_assignee_id').references(() => users.id),
  confidence: real('confidence'),
  reasoning: text('reasoning'),
  triagedAt: timestamp('triaged_at', { withTimezone: true }).notNull().defaultNow(),
});
