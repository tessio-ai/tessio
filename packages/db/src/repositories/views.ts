// SPDX-License-Identifier: AGPL-3.0-only

import { and, eq } from 'drizzle-orm';
import type { FilterNode, SortField } from '@tessio/shared';
import { views } from '../schema';
import type { Db } from '../client';

export interface NewView {
  targetKind: 'ticket' | 'asset' | 'kb_article' | 'form';
  name: string;
  filter?: FilterNode;
  sort?: SortField[];
  columns?: string[];
  ownerId?: string;
  shared?: boolean;
}

export function viewsRepo(db: Db) {
  return {
    async create(orgId: string, view: NewView) {
      const rows = await db.insert(views).values({ orgId, ...view }).returning();
      return rows[0];
    },
    async getById(orgId: string, id: string) {
      const rows = await db.select().from(views).where(and(eq(views.orgId, orgId), eq(views.id, id)));
      return rows[0];
    },
    async list(orgId: string) {
      return db.select().from(views).where(eq(views.orgId, orgId));
    },
  };
}
