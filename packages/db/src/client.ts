// SPDX-License-Identifier: AGPL-3.0-only

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

/**
 * Build a Drizzle client bound to a Postgres connection string.
 * The underlying pg Pool is reachable as `db.$client` for graceful
 * shutdown (e.g. `await db.$client.end()` on SIGTERM).
 */
export function createDbClient(connectionString: string) {
  const pool = new Pool({ connectionString });
  return drizzle(pool, { schema });
}

export type Db = ReturnType<typeof createDbClient>;
