// SPDX-License-Identifier: AGPL-3.0-only

import { and, eq, desc, max } from 'drizzle-orm';
import { kbRevisions, kbArticles } from '../schema';
import type { Db } from '../client';

export function kbRevisionsRepo(db: Db) {
  return {
    /** Record a new revision of the article's current content (next version) + sync contentVersion. */
    async snapshot(orgId: string, article: { id: string; title: string | null; data: Record<string, unknown> }, authorId: string | null) {
      const [row] = await db.select({ v: max(kbRevisions.version) }).from(kbRevisions).where(eq(kbRevisions.articleId, article.id));
      const version = (row?.v ?? 0) + 1;
      const inserted = await db.insert(kbRevisions).values({ orgId, articleId: article.id, version, title: article.title, data: article.data, authorId }).returning();
      await db.update(kbArticles).set({ contentVersion: version }).where(and(eq(kbArticles.orgId, orgId), eq(kbArticles.id, article.id)));
      return inserted[0];
    },
    async list(orgId: string, articleId: string) {
      return db.select({ id: kbRevisions.id, version: kbRevisions.version, title: kbRevisions.title, authorId: kbRevisions.authorId, createdAt: kbRevisions.createdAt })
        .from(kbRevisions).where(and(eq(kbRevisions.orgId, orgId), eq(kbRevisions.articleId, articleId)))
        .orderBy(desc(kbRevisions.version));
    },
    async get(orgId: string, articleId: string, revisionId: string) {
      const rows = await db.select().from(kbRevisions).where(and(eq(kbRevisions.orgId, orgId), eq(kbRevisions.articleId, articleId), eq(kbRevisions.id, revisionId)));
      return rows[0];
    },
  };
}
