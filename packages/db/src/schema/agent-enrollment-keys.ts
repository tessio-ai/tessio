// SPDX-License-Identifier: AGPL-3.0-only

import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { orgs } from './orgs';
import { users } from './users';

/**
 * Org-scoped endpoint-agent enrollment keys. Stored as a one-way hash + a 4-char
 * hint; the plaintext is shown exactly once at creation. An agent presents the key
 * on first run to self-register and receive a per-device token.
 */
export const agentEnrollmentKeys = pgTable(
  'agent_enrollment_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => orgs.id),
    label: text('label').notNull().default(''),
    keyHash: text('key_hash').notNull(),
    hint: text('hint').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => [
    index('agent_enrollment_keys_org_idx').on(t.orgId),
    index('agent_enrollment_keys_hash_idx').on(t.keyHash),
  ],
);
