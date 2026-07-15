// SPDX-License-Identifier: AGPL-3.0-only

import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, isNull, lt } from 'drizzle-orm';
import { passwordResetTokens } from '../schema';
import type { Db } from '../client';

const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export function passwordResetsRepo(db: Db) {
  return {
    /**
     * Mint a reset token for a user, invalidating any still-pending ones so at
     * most one link works at a time. Returns the PLAINTEXT token — the only
     * time it exists outside the emailed link; only its hash is stored.
     */
    async create(opts: { orgId: string; userId: string; ttlMs?: number }) {
      await db
        .update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(and(eq(passwordResetTokens.userId, opts.userId), isNull(passwordResetTokens.usedAt)));
      const token = randomBytes(32).toString('base64url');
      const expiresAt = new Date(Date.now() + (opts.ttlMs ?? DEFAULT_TTL_MS));
      await db.insert(passwordResetTokens).values({ orgId: opts.orgId, userId: opts.userId, tokenHash: hashToken(token), expiresAt });
      return { token, expiresAt };
    },
    /**
     * Atomically redeem a token: marks it used and returns the row, or null if
     * it is unknown, already used, or expired. Single UPDATE … RETURNING, so
     * two concurrent submits of the same link cannot both succeed.
     */
    async consume(token: string) {
      const rows = await db
        .update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(
          and(
            eq(passwordResetTokens.tokenHash, hashToken(token)),
            isNull(passwordResetTokens.usedAt),
            gt(passwordResetTokens.expiresAt, new Date()),
          ),
        )
        .returning();
      return rows[0] ?? null;
    },
    async deleteExpired() {
      await db.delete(passwordResetTokens).where(lt(passwordResetTokens.expiresAt, new Date()));
    },
  };
}
