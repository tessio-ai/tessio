// SPDX-License-Identifier: AGPL-3.0-only

import { pgTable, uuid, timestamp, unique } from 'drizzle-orm/pg-core';
import { teams } from './teams';
import { users } from './users';

export const teamMembers = pgTable(
  'team_members',
  {
    teamId: uuid('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('team_members_pk').on(t.teamId, t.userId)],
);
