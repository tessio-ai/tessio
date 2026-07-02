// SPDX-License-Identifier: AGPL-3.0-only

import { pgTable, uuid, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { orgs } from './orgs';

/** A team / queue a ticket can be routed to. Unique by name per org. */
export const teams = pgTable(
  'teams',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => orgs.id),
    name: text('name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('teams_org_name_key').on(t.orgId, t.name)],
);
