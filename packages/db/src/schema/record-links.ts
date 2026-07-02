// SPDX-License-Identifier: AGPL-3.0-only

import { pgTable, uuid, text, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { orgs } from './orgs';
import { recordType } from './foundation';

/** Typed relationships between records — the CMDB / cross-record graph (spec 4.5). */
export const recordLinks = pgTable(
  'record_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id),
    fromType: recordType('from_type').notNull(),
    fromId: uuid('from_id').notNull(),
    toType: recordType('to_type').notNull(),
    toId: uuid('to_id').notNull(),
    relationshipType: text('relationship_type').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('record_links_from_idx').on(t.orgId, t.fromType, t.fromId),
    index('record_links_to_idx').on(t.orgId, t.toType, t.toId),
    index('record_links_rel_idx').on(t.orgId, t.relationshipType),
  ],
);
