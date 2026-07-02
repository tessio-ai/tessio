// SPDX-License-Identifier: AGPL-3.0-only

import { pgTable, uuid, text, integer, primaryKey } from 'drizzle-orm/pg-core';
import { orgs } from './orgs';

/** Per-org monotonic counters (e.g. ticket numbers). One row per (org, entity). */
export const orgCounters = pgTable(
  'org_counters',
  {
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id),
    entity: text('entity').notNull(),
    value: integer('value').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.orgId, t.entity] })],
);
