// SPDX-License-Identifier: AGPL-3.0-only

import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { orgs } from './orgs';
import { users } from './users';

/** Server-side sessions; the `id` is the (signed) cookie value. */
export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);
