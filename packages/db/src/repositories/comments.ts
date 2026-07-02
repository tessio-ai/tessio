// SPDX-License-Identifier: AGPL-3.0-only

import { and, eq, asc } from 'drizzle-orm';
import { comments } from '../schema';
import type { RecordKind } from './links';
import type { Db } from '../client';

export interface NewComment {
  orgId: string;
  recordType: RecordKind;
  recordId: string;
  authorId?: string;
  body: string;
  internal?: boolean;
}

export async function addComment(db: Db, comment: NewComment) {
  const rows = await db.insert(comments).values(comment).returning();
  return rows[0];
}

/** List a record's comments, oldest first (chronological thread). */
export async function listComments(
  db: Db,
  orgId: string,
  recordType: RecordKind,
  recordId: string,
  opts: { excludeInternal?: boolean } = {},
) {
  const conds = [
    eq(comments.orgId, orgId),
    eq(comments.recordType, recordType),
    eq(comments.recordId, recordId),
  ];
  if (opts.excludeInternal) conds.push(eq(comments.internal, false));
  return db
    .select()
    .from(comments)
    .where(and(...conds))
    .orderBy(asc(comments.createdAt), asc(comments.id));
}
