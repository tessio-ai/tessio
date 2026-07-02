// SPDX-License-Identifier: AGPL-3.0-only

import { pgTable, uuid, text, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { orgs } from './orgs';
import { recordType } from './foundation';

/** Append-only event stream (spec 4.6). Powers the timeline and can feed
 *  workflow triggers. Long-retention exportable audit logs are a planned core feature. */
export const activity = pgTable(
  'activity',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id),
    actorId: uuid('actor_id'),
    recordType: recordType('record_type').notNull(),
    recordId: uuid('record_id').notNull(),
    eventType: text('event_type').notNull(),
    changes: jsonb('changes').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('activity_record_idx').on(t.orgId, t.recordType, t.recordId, t.createdAt)],
);
