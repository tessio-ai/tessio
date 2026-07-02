// SPDX-License-Identifier: AGPL-3.0-only

import { and, eq, desc } from 'drizzle-orm';
import { activity } from '../schema';
import type { RecordKind } from './links';
import type { Db } from '../client';

export interface NewActivity {
  orgId: string;
  actorId?: string;
  recordType: RecordKind;
  recordId: string;
  eventType: string;
  changes?: Record<string, unknown>;
}

/** Append one event to the activity stream. */
export async function recordActivity(db: Db, event: NewActivity) {
  const rows = await db.insert(activity).values(event).returning();
  return rows[0];
}

/** List a record's events, newest first. */
export async function listActivity(db: Db, orgId: string, recordType: RecordKind, recordId: string) {
  return db
    .select()
    .from(activity)
    .where(and(eq(activity.orgId, orgId), eq(activity.recordType, recordType), eq(activity.recordId, recordId)))
    .orderBy(desc(activity.createdAt), desc(activity.id));
}
