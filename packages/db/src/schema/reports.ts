// SPDX-License-Identifier: AGPL-3.0-only

import { pgTable, uuid, text, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import type { ReportDefinition } from '@tessio/shared';
import { orgs } from './orgs';
import { users } from './users';

export const reports = pgTable(
  'reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => orgs.id),
    name: text('name').notNull(),
    description: text('description'),
    definition: jsonb('definition').$type<ReportDefinition>().notNull(),
    ownerId: uuid('owner_id').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('reports_org_idx').on(t.orgId)],
);
