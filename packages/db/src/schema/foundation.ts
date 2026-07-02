// SPDX-License-Identifier: AGPL-3.0-only

import { pgEnum, uuid, integer, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { orgs } from './orgs';
import { schemas } from './schemas';
import { users } from './users';

/** The kinds of records edges, activity, and comments can point at. */
export const recordType = pgEnum('record_type', ['ticket', 'asset', 'kb_article', 'form_submission']);

/**
 * Shared columns on every domain record table (spec 4.4) — a column mixin,
 * NOT Postgres table inheritance. Spread first in each record table:
 *   pgTable('tickets', { ...foundationColumns, ...ticketColumns }, ...)
 *
 * `data` holds the schema-defined custom fields (validation against the pinned
 * schema version is the API/forms sub-project's job — stored as-is here).
 */
export const foundationColumns = {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id),
  schemaId: uuid('schema_id')
    .notNull()
    .references(() => schemas.id),
  schemaVersion: integer('schema_version').notNull(),
  data: jsonb('data').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  // FKs to users.id (added by the auth sub-project).
  createdBy: uuid('created_by').references(() => users.id),
  updatedBy: uuid('updated_by').references(() => users.id),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
};
