// SPDX-License-Identifier: AGPL-3.0-only

import { pgTable, uuid, text, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { orgs } from './orgs';
import { recordType } from './foundation';

/** Comments (spec 4.6). The visible timeline is a merge of comments + activity. */
export const comments = pgTable(
  'comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id),
    recordType: recordType('record_type').notNull(),
    recordId: uuid('record_id').notNull(),
    authorId: uuid('author_id'),
    body: text('body').notNull(),
    internal: boolean('internal').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('comments_record_idx').on(t.orgId, t.recordType, t.recordId, t.createdAt)],
);
