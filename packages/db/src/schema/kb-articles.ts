// SPDX-License-Identifier: AGPL-3.0-only

import { pgTable, pgEnum, uuid, text, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { foundationColumns } from './foundation';

export const kbStatus = pgEnum('kb_status', ['draft', 'published']);

/** Knowledge-base articles (spec 4.4). content_version tracks article-content
 *  history, distinct from schema versioning. */
export const kbArticles = pgTable(
  'kb_articles',
  {
    ...foundationColumns,
    title: text('title'),
    slug: text('slug'),
    status: kbStatus('status'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    authorId: uuid('author_id'),
    contentVersion: integer('content_version').notNull().default(1),
  },
  (t) => [
    index('kb_articles_org_idx').on(t.orgId),
    index('kb_articles_org_status_idx').on(t.orgId, t.status),
    index('kb_articles_data_gin_idx').using('gin', t.data),
  ],
);
