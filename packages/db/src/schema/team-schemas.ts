// SPDX-License-Identifier: AGPL-3.0-only

import { pgTable, uuid, timestamp, unique } from 'drizzle-orm/pg-core';
import { teams } from './teams';
import { schemas } from './schemas';

export const teamSchemas = pgTable(
  'team_schemas',
  {
    teamId: uuid('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
    schemaId: uuid('schema_id').notNull().references(() => schemas.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('team_schemas_pk').on(t.teamId, t.schemaId)],
);
