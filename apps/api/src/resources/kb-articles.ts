// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod';
import type { Db } from '@tessio/db';
import { kbArticlesRepo, kbRevisionsRepo } from '@tessio/db';
import { baseCreateFields } from './schemas';
import type { ResourceConfig, ResourceRepo } from './resource-routes';

const kbCreate = z.object({
  ...baseCreateFields,
  title: z.string().optional(),
  slug: z.string().optional(),
  status: z.enum(['draft', 'published']).optional(),
  publishedAt: z.coerce.date().optional(),
  authorId: z.string().uuid().optional(),
  contentVersion: z.number().int().positive().optional(),
});
const kbUpdate = kbCreate.partial().omit({ schemaId: true, schemaVersion: true });

export function kbArticlesResource(db: Db): ResourceConfig {
  return {
    path: 'kb-articles',
    repo: kbArticlesRepo(db) as unknown as ResourceRepo,
    createSchema: kbCreate,
    updateSchema: kbUpdate,
    afterCreate: async ({ orgId, actorId }, row) => {
      await kbRevisionsRepo(db).snapshot(orgId, { id: row.id as string, title: (row.title as string) ?? null, data: (row.data as Record<string, unknown>) ?? {} }, actorId);
    },
    afterUpdate: async ({ orgId, actorId }, _before, after) => {
      await kbRevisionsRepo(db).snapshot(orgId, { id: after.id as string, title: (after.title as string) ?? null, data: (after.data as Record<string, unknown>) ?? {} }, actorId);
    },
  };
}
