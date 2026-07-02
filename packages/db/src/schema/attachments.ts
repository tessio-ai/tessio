// SPDX-License-Identifier: AGPL-3.0-only

import { pgTable, uuid, text, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { orgs } from './orgs';
import { users } from './users';
import { recordType } from './foundation';

/** A file attached to a record (ticket/asset/…). Bytes live in Storage; this is metadata. */
export const attachments = pgTable(
  'attachments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => orgs.id),
    recordType: recordType('record_type').notNull(),
    recordId: uuid('record_id').notNull(),
    filename: text('filename').notNull(),
    size: integer('size').notNull(),
    mime: text('mime').notNull(),
    storageKey: text('storage_key').notNull(),
    uploadedBy: uuid('uploaded_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('attachments_record_idx').on(t.orgId, t.recordType, t.recordId)],
);
