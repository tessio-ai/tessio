// SPDX-License-Identifier: AGPL-3.0-only

import { auditRepo, type Db } from '@tessio/db';

export interface AuditEntry {
  orgId: string;
  actorId?: string | null;
  actorEmail: string;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
  ip?: string | null;
}

/** Best-effort: never throw into the request being audited. */
export async function recordAudit(db: Db, e: AuditEntry): Promise<void> {
  try {
    await auditRepo(db).record({
      orgId: e.orgId,
      actorId: e.actorId ?? null,
      actorEmail: e.actorEmail,
      action: e.action,
      targetType: e.targetType ?? null,
      targetId: e.targetId ?? null,
      metadata: e.metadata ?? {},
      ip: e.ip ?? null,
    });
  } catch (err) {
    console.error('recordAudit failed', e.action, err);
  }
}

/** Pick only allow-listed keys (so secret/value fields are never recorded). */
export function safeMeta(obj: Record<string, unknown>, allowed: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of allowed) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
}
