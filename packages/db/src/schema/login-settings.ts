// SPDX-License-Identifier: AGPL-3.0-only

import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { orgs } from './orgs';
import { users } from './users';

/** One row per org — branding for the sign-in screen (logo, name, copy). */
export const loginSettings = pgTable('login_settings', {
  orgId: uuid('org_id').primaryKey().references(() => orgs.id),
  brandName: text('brand_name').notNull().default('Tessio'),
  /** data: URL of an uploaded logo image; null → the default mark. */
  logo: text('logo'),
  headline: text('headline').notNull().default('Welcome back'),
  tagline: text('tagline').notNull().default('Sign in to your workspace to pick up where you left off.'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedBy: uuid('updated_by').references(() => users.id),
});
