// SPDX-License-Identifier: AGPL-3.0-only

import { pgTable, uuid, boolean, text, timestamp } from 'drizzle-orm/pg-core';
import { orgs } from './orgs';
import { users } from './users';

/** Per-org satisfaction survey configuration (one row per org, like sla_settings). */
export const csatSettings = pgTable('csat_settings', {
  orgId: uuid('org_id').primaryKey().references(() => orgs.id),
  enabled: boolean('enabled').notNull().default(false),
  /** Custom survey question; null falls back to the shared default. */
  question: text('question'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedBy: uuid('updated_by').references(() => users.id),
});
