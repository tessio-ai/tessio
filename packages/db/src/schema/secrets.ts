// SPDX-License-Identifier: AGPL-3.0-only

import { pgTable, uuid, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { orgs } from './orgs';
import { users } from './users';

/** Encrypted, org-scoped workflow secrets. Value is never returned to clients. */
export const secrets = pgTable(
  'secrets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => orgs.id),
    // ^[a-z0-9_]+$ (enforced in the API); safe inside {{ secrets.<name> }}.
    name: text('name').notNull(),
    valueCiphertext: text('value_ciphertext').notNull(),
    hint: text('hint').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id),
    updatedBy: uuid('updated_by').references(() => users.id),
  },
  (t) => ({ orgName: unique('secrets_org_name').on(t.orgId, t.name) }),
);
