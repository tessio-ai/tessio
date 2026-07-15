// SPDX-License-Identifier: AGPL-3.0-only

import { pgTable, pgEnum, uuid, text, timestamp, unique, jsonb, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { NotificationPrefs } from '@tessio/shared';
import { orgs } from './orgs';

export const userRole = pgEnum('user_role', ['admin', 'agent', 'requester']);
export const userStatus = pgEnum('user_status', ['active', 'disabled']);

/** People who can sign in. Email is stored lower-cased; unique per org. */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id),
    email: text('email').notNull(),
    name: text('name').notNull(),
    passwordHash: text('password_hash').notNull(),
    role: userRole('role').notNull(),
    status: userStatus('status').notNull().default('active'),
    notificationPrefs: jsonb('notification_prefs').$type<NotificationPrefs>().notNull()
      .default({ emailEnabled: true, assigned: true, replies: true, statusChanges: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('users_org_email_key').on(t.orgId, t.email),
    // Billable-seat counting (usersRepo.countBillable) runs on every user
    // create/promotion and on /me/entitlements; the partial index keeps it an
    // index-only scan over the handful of billable rows instead of a full
    // org scan across unlimited requesters.
    index('users_org_billable_idx')
      .on(t.orgId)
      .where(sql`${t.status} = 'active' and ${t.role} in ('admin', 'agent')`),
  ],
);
