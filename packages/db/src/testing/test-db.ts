// SPDX-License-Identifier: AGPL-3.0-only

import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool, Client } from 'pg';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as schema from '../schema';
import { schemas, orgs } from '../schema';
import type { SchemaDefinition } from '@tessio/shared';

/** Dedicated test database so integration tests never touch dev data. */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://tessio:tessio@localhost:5432/tessio_test';

export function createTestDb() {
  const pool = new Pool({ connectionString: TEST_DATABASE_URL });
  return drizzle(pool, { schema });
}
export type TestDb = ReturnType<typeof createTestDb>;

/**
 * Truncate every data table in the `public` schema (keeps the schema itself).
 * Dynamic so it works no matter which tables exist yet as the model grows —
 * drizzle's migration bookkeeping lives in the `drizzle` schema, so it's untouched.
 * Call in beforeEach.
 */
export async function resetDb(db: TestDb): Promise<void> {
  await db.execute(sql`
    DO $$
    DECLARE r RECORD;
    BEGIN
      FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
      LOOP
        EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' RESTART IDENTITY CASCADE';
      END LOOP;
    END $$;
  `);
}

const EMPTY_DEFINITION: SchemaDefinition = { fields: [] };

/** Insert an org + a published schema of the given kind; return the ids a record needs. */
export async function seedOrgAndSchema(
  db: TestDb,
  kind: 'ticket' | 'asset' | 'kb_article' | 'form',
): Promise<{ orgId: string; schemaId: string; schemaVersion: number }> {
  const [org] = await db
    .insert(orgs)
    .values({ name: 'Test Org', slug: `org-${crypto.randomUUID()}` })
    .returning();
  const [schemaRow] = await db
    .insert(schemas)
    .values({
      orgId: org.id,
      kind,
      key: `${kind}_default`,
      name: `${kind} default`,
      status: 'published',
      definition: EMPTY_DEFINITION,
    })
    .returning();
  return { orgId: org.id, schemaId: schemaRow.id, schemaVersion: schemaRow.version };
}

/**
 * Ensure the test database exists and all migrations are applied. Idempotent.
 * Resolves the migrations folder relative to THIS file so it works regardless of
 * which package's tests call it. Reusable by any app package's integration setup.
 */
export async function ensureTestDbMigrated(): Promise<void> {
  const url = new URL(TEST_DATABASE_URL);
  const testDbName = url.pathname.slice(1);

  const adminUrl = new URL(TEST_DATABASE_URL);
  adminUrl.pathname = '/postgres';
  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [testDbName]);
  if (exists.rowCount === 0) {
    await admin.query(`CREATE DATABASE "${testDbName}"`);
  }
  await admin.end();

  const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), '../../migrations');
  const db = createTestDb();
  await migrate(db, { migrationsFolder });
  await db.$client.end();
}
