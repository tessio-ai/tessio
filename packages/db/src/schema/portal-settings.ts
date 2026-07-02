// SPDX-License-Identifier: AGPL-3.0-only

import { pgTable, uuid, text, boolean, jsonb, timestamp } from 'drizzle-orm/pg-core';
import type { PortalCategory, PortalHero, PortalCatalogConfig } from '@tessio/shared';
import { orgs } from './orgs';
import { users } from './users';

/** One row per org — the requester portal homepage shell. */
export const portalSettings = pgTable('portal_settings', {
  orgId: uuid('org_id').primaryKey().references(() => orgs.id),
  brandName: text('brand_name').notNull().default('Help Center'),
  logo: text('logo'),
  heroHeadline: text('hero_headline').notNull().default('How can we help?'),
  heroIntro: text('hero_intro'),
  accent: text('accent').notNull().default('#4f46e5'),
  showTess: boolean('show_tess').notNull().default(true),
  categories: jsonb('categories').$type<PortalCategory[]>().notNull().default([]),
  hero: jsonb('hero').$type<PortalHero>().notNull().default({ preset: 'spotlight', pills: [], showSearch: true }),
  catalog: jsonb('catalog').$type<PortalCatalogConfig>().notNull()
    .default({ sectionStyle: 'band', cardStyle: 'comfortable', columns: 'auto' }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedBy: uuid('updated_by').references(() => users.id),
});
