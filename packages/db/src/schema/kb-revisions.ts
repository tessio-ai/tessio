// SPDX-License-Identifier: AGPL-3.0-only

import { pgTable, uuid, text, integer, jsonb, timestamp, unique, index } from 'drizzle-orm/pg-core';
import { orgs } from './orgs';
import { users } from './users';
import { kbArticles } from './kb-articles';

/** Append-only content snapshots of a kb article (one per saved version). */
export const kbRevisions = pgTable('kb_revisions', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => orgs.id),
  articleId: uuid('article_id').notNull().references(() => kbArticles.id),
  version: integer('version').notNull(),
  title: text('title'),
  data: jsonb('data').$type<Record<string, unknown>>().notNull().default({}),
  authorId: uuid('author_id').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('kb_revisions_article_version_key').on(t.articleId, t.version),
  index('kb_revisions_article_idx').on(t.orgId, t.articleId),
]);
