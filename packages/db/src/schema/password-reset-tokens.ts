// SPDX-License-Identifier: AGPL-3.0-only

import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { orgs } from './orgs';
import { users } from './users';

/**
 * Self-serve password-reset tokens. Only a SHA-256 hash of the token is
 * stored — the plaintext exists once, inside the emailed link — so a database
 * leak cannot be replayed into account takeovers. Rows are single-use
 * (consumed sets usedAt) and short-lived (expiresAt).
 */
export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    /** sha256 hex of the emailed token — the lookup key on consume. */
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('password_reset_tokens_user_idx').on(t.userId)],
);
