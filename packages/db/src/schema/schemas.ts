// SPDX-License-Identifier: AGPL-3.0-only

import { pgTable, pgEnum, uuid, text, integer, jsonb, timestamp, unique } from 'drizzle-orm/pg-core';
import type { SchemaDefinition } from '@tessio/shared';
import { orgs } from './orgs';

export const schemaKind = pgEnum('schema_kind', ['ticket', 'asset', 'kb_article', 'form']);
export const schemaStatus = pgEnum('schema_status', ['draft', 'published', 'archived']);

/** Versioned record-type definitions (spec 4.3). */
export const schemas = pgTable(
  'schemas',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // ON DELETE no action (default): an org with child schemas cannot be
    // deleted until its schemas are archived/removed first.
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id),
    kind: schemaKind('kind').notNull(),
    key: text('key').notNull(),
    name: text('name').notNull(),
    version: integer('version').notNull().default(1),
    status: schemaStatus('status').notNull().default('draft'),
    definition: jsonb('definition').$type<SchemaDefinition>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    // FK to users.id deferred to the auth sub-project (no users table yet).
    createdBy: uuid('created_by'),
  },
  (t) => [unique().on(t.orgId, t.kind, t.key, t.version)],
);
