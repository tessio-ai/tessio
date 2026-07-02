// SPDX-License-Identifier: AGPL-3.0-only

import { pgTable, pgEnum, uuid, text, jsonb, timestamp, unique, index } from 'drizzle-orm/pg-core';
import type { FormDefinition, PortalTheme } from '@tessio/shared';
import { orgs } from './orgs';
import { schemas } from './schemas';
import { users } from './users';

export const formStatus = pgEnum('form_status', ['draft', 'published', 'archived']);

/** A themed, validated intake view over a ticket-type schema. */
export const forms = pgTable(
  'forms',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => orgs.id),
    key: text('key').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    icon: text('icon'),
    categoryKey: text('category_key').notNull(),
    targetSchemaId: uuid('target_schema_id').notNull().references(() => schemas.id),
    status: formStatus('status').notNull().default('draft'),
    theme: jsonb('theme').$type<PortalTheme>().notNull(),
    definition: jsonb('definition').$type<FormDefinition>().notNull().default({ sections: [] }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id),
    updatedBy: uuid('updated_by').references(() => users.id),
  },
  (t) => [unique('forms_org_key_key').on(t.orgId, t.key), index('forms_org_status_idx').on(t.orgId, t.status)],
);
