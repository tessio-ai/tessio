// SPDX-License-Identifier: AGPL-3.0-only

import { pgTable, uuid, boolean, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { orgs } from './orgs';
import { users } from './users';
import type { SlaTargets } from '@tessio/shared';

export const slaSettings = pgTable('sla_settings', {
  orgId: uuid('org_id').primaryKey().references(() => orgs.id),
  enabled: boolean('enabled').notNull().default(false),
  targets: jsonb('targets').$type<SlaTargets>().notNull().default({}),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedBy: uuid('updated_by').references(() => users.id),
});
