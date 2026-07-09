// SPDX-License-Identifier: AGPL-3.0-only

import { pgTable, uuid, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { orgs } from './orgs';

/** A team / queue a ticket can be routed to. Unique by name per org. */
export const teams = pgTable(
  'teams',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => orgs.id),
    name: text('name').notNull(),
    /** Optional per-team address: used as the outbound From and matched against
     *  inbound recipients to route new tickets to this team. Falls back to the
     *  org-level email settings when unset. */
    emailAddress: text('email_address'),
    /** Optional display name for the outbound From header (e.g. "HR Desk"). */
    emailName: text('email_name'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('teams_org_name_key').on(t.orgId, t.name),
    unique('teams_org_email_key').on(t.orgId, t.emailAddress),
  ],
);
