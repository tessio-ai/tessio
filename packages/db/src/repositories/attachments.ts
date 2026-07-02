// SPDX-License-Identifier: AGPL-3.0-only

import { and, eq, desc } from 'drizzle-orm';
import { attachments } from '../schema';
import type { RecordKind } from './links';
import type { Db } from '../client';

type AttachmentInsert = typeof attachments.$inferInsert;

export function attachmentsRepo(db: Db) {
  return {
    async create(values: AttachmentInsert) {
      const rows = await db.insert(attachments).values(values).returning();
      return rows[0];
    },
    async list(orgId: string, recordType: RecordKind, recordId: string) {
      return db.select().from(attachments)
        .where(and(eq(attachments.orgId, orgId), eq(attachments.recordType, recordType), eq(attachments.recordId, recordId)))
        .orderBy(desc(attachments.createdAt), desc(attachments.id));
    },
    async findById(orgId: string, id: string) {
      const rows = await db.select().from(attachments).where(and(eq(attachments.orgId, orgId), eq(attachments.id, id)));
      return rows[0];
    },
    async remove(orgId: string, id: string) {
      await db.delete(attachments).where(and(eq(attachments.orgId, orgId), eq(attachments.id, id)));
    },
  };
}
