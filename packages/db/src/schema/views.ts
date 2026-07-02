// SPDX-License-Identifier: AGPL-3.0-only

import { pgTable, uuid, text, jsonb, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import type { FilterNode, SortField } from '@tessio/shared';
import { orgs } from './orgs';
import { schemaKind } from './schemas';

/**
 * Saved queries (spec 4.7). filter/sort/columns hold the shared query AST
 * (compiled by the #2b query layer). target_kind reuses schema_kind.
 */
export const views = pgTable(
  'views',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id),
    targetKind: schemaKind('target_kind').notNull(),
    name: text('name').notNull(),
    filter: jsonb('filter').$type<FilterNode>(),
    sort: jsonb('sort').$type<SortField[]>(),
    columns: jsonb('columns').$type<string[]>(),
    ownerId: uuid('owner_id'),
    shared: boolean('shared').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('views_org_kind_idx').on(t.orgId, t.targetKind)],
);
