// SPDX-License-Identifier: AGPL-3.0-only

import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';

/** Multi-tenancy root (spec 4.9). Community runs a single default org. */
export const orgs = pgTable('orgs', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
