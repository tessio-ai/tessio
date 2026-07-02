// SPDX-License-Identifier: AGPL-3.0-only

/**
 * The contract between the core application and the Enterprise Edition (`ee/`).
 *
 * These are TYPE-ONLY declarations (erased at runtime), so importing them adds
 * no runtime dependency and never pulls Fastify into non-server bundles. They
 * live in core (AGPL) so that BOTH sides can depend on them without core ever
 * importing `ee/`:
 *   - core (apps/api) builds an `EnterpriseContext` and calls an
 *     `EnterprisePlugin`'s hooks at the right Fastify scopes;
 *   - `ee/` implements `EnterprisePlugin` using only this contract + core packages.
 */

import type { FastifyInstance, FastifyReply } from 'fastify';
import type { Db } from '@tessio/db';

/** Audit entry shape — mirrors the core `recordAudit` writer (kept in core). */
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

/**
 * Core capabilities injected into enterprise plugins so `ee/` never has to
 * import from `apps/api`. Everything here is implemented in core and passed in.
 */
export interface EnterpriseContext {
  db: Db;
  /** Set the signed session cookie (core auth). */
  setSessionCookie(reply: FastifyReply, sessionId: string): void;
  /** Append an audit-log entry (the writer stays in core; best-effort). */
  recordAudit(db: Db, entry: AuditEntry): Promise<void> | void;
  /** Allow-list helper so secrets never reach the audit log. */
  safeMeta(obj: Record<string, unknown>, allowed: string[]): Record<string, unknown>;
}

/**
 * An enterprise plugin contributes routes at one or both Fastify scopes. The
 * plugin is responsible for checking its own feature entitlement
 * (`isFeatureEnabled(...)`) before registering anything.
 */
export interface EnterprisePlugin {
  /** Public `/api/v1` scope (pre-session) — e.g. SSO start/callback/info. */
  registerPublic?(scope: FastifyInstance, ctx: EnterpriseContext): void;
  /** Admin scope (already guarded by requireRole('admin')) — e.g. SSO settings, audit viewer. */
  registerAdmin?(scope: FastifyInstance, ctx: EnterpriseContext): void;
}
