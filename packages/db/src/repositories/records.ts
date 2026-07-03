// SPDX-License-Identifier: AGPL-3.0-only

import { and, eq, isNull, asc, desc, sql, type SQL } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import type { FilterNode, SortField } from '@tessio/shared';
import { compileFilter, resolveFieldExpr, castedValue } from '../query/compile-filter';
import { encodeCursor, decodeCursor } from '../query/cursor';
import type { Db } from '../client';
import { teamSchemas, teamMembers } from '../schema';

/** Structural constraint: any record table carrying the foundation columns. */
export type RecordTable = PgTable & {
  id: PgColumn;
  orgId: PgColumn;
  data: PgColumn;
  updatedAt: PgColumn;
  deletedAt: PgColumn;
};

export interface Pagination {
  limit?: number;
  offset?: number;
}

const DATA_PREFIX = 'data.';
const MAX_LIMIT = 200;

export interface QueryOptions {
  filter?: FilterNode;
  sort?: SortField;
  limit?: number;
  cursor?: string;
}

export interface QueryResult<Row> {
  rows: Row[];
  nextCursor: string | null;
}

export interface TeamScope {
  userId: string;
  // `role` is intentionally widened to string: teamScopeCondition special-cases
  // 'admin'/'requester' and treats anything else as an agent (most-restrictive,
  // fail-closed), so callers can pass a loosely-typed role without narrowing.
  role: string;
}

/** Extract the sort field's value from a returned row (for the next cursor). */
function rowSortValue(row: Record<string, unknown>, field: string): unknown {
  if (field.startsWith(DATA_PREFIX)) {
    const data = (row.data ?? {}) as Record<string, unknown>;
    return data[field.slice(DATA_PREFIX.length)] ?? null;
  }
  return row[field] ?? null;
}

/**
 * Org-scoped CRUD over any table with the foundation columns. Soft-deleted rows
 * (deleted_at IS NOT NULL) are excluded from getById and list. List supports
 * equality filters on system columns; the rich filter-AST compiler is sub-project #2b.
 */
export function createRecordRepository<T extends RecordTable>(db: Db, table: T) {
  type Row = T['$inferSelect'];
  type Insert = T['$inferInsert'];

  const cols = table as unknown as Record<string, PgColumn>;

  function teamScopeCondition(scope: TeamScope): SQL | null {
    if (scope.role === 'admin') return null;
    if (scope.role === 'requester') return null;
    // Agent: only see tickets whose schemaId is unscoped OR belongs to one of their teams
    return sql`(
      NOT EXISTS (SELECT 1 FROM ${teamSchemas} WHERE ${teamSchemas.schemaId} = ${table.id.table}.schema_id)
      OR ${table.id.table}.schema_id IN (
        SELECT ${teamSchemas.schemaId} FROM ${teamSchemas}
        JOIN ${teamMembers} ON ${teamMembers.teamId} = ${teamSchemas.teamId}
        WHERE ${teamMembers.userId} = ${scope.userId}
      )
    )`;
  }

  return {
    /**
     * Fetch one row by id within an org. When `teamScope` is supplied (only
     * meaningful for team-scoped tables such as tickets) the same visibility
     * predicate used by list/query is applied, so an agent cannot read a row
     * whose schema is walled off from their teams by referencing its id directly.
     */
    async getById(orgId: string, id: string, teamScope?: TeamScope): Promise<Row | undefined> {
      const conditions: SQL[] = [eq(table.orgId, orgId), eq(table.id, id), isNull(table.deletedAt)];
      if (teamScope) {
        const sc = teamScopeCondition(teamScope);
        if (sc) conditions.push(sc);
      }
      const rows = await db
        .select()
        .from(table as PgTable)
        .where(and(...conditions));
      return rows[0] as Row | undefined;
    },

    async create(values: Insert): Promise<Row> {
      const rows = (await db.insert(table).values(values).returning()) as Row[];
      return rows[0];
    },

    async update(orgId: string, id: string, patch: Partial<Insert>): Promise<Row | undefined> {
      const rows = (await db
        .update(table)
        .set({ ...patch, updatedAt: new Date() } as Partial<Insert>)
        .where(and(eq(table.orgId, orgId), eq(table.id, id), isNull(table.deletedAt)))
        .returning()) as Row[];
      return rows[0];
    },

    async softDelete(orgId: string, id: string): Promise<void> {
      await db
        .update(table)
        .set({ deletedAt: new Date() } as Partial<Insert>)
        .where(and(eq(table.orgId, orgId), eq(table.id, id), isNull(table.deletedAt)));
    },

    async list(
      orgId: string,
      filters: Partial<Record<keyof Row, unknown>> = {},
      page: Pagination = {},
      teamScope?: TeamScope,
    ): Promise<Row[]> {
      const conditions: SQL[] = [eq(table.orgId, orgId), isNull(table.deletedAt)];
      for (const [key, value] of Object.entries(filters)) {
        const column = cols[key];
        if (column) conditions.push(eq(column, value));
      }
      if (teamScope) {
        const sc = teamScopeCondition(teamScope);
        if (sc) conditions.push(sc);
      }
      let query = db
        .select()
        // Cast away the generic table: drizzle's `.from` selection-guard can't reduce
        // over `T`, and the row shape is reapplied via the `as Row[]` cast below.
        .from(table as PgTable)
        .where(and(...conditions))
        .$dynamic();
      if (page.limit !== undefined) query = query.limit(page.limit);
      if (page.offset !== undefined) query = query.offset(page.offset);
      return (await query) as Row[];
    },

    async query(orgId: string, opts: QueryOptions = {}, teamScope?: TeamScope): Promise<QueryResult<Row>> {
      const take = Math.min(opts.limit ?? 50, MAX_LIMIT);
      const conditions: SQL[] = [eq(table.orgId, orgId), isNull(table.deletedAt)];
      if (opts.filter) conditions.push(compileFilter(table, opts.filter));
      if (teamScope) {
        const sc = teamScopeCondition(teamScope);
        if (sc) conditions.push(sc);
      }

      const sortF = opts.sort;
      // Keyset predicate from the cursor.
      if (opts.cursor) {
        const pos = decodeCursor(opts.cursor);
        if (sortF) {
          const col = resolveFieldExpr(table, sortF.field, sortF.type);
          const val = castedValue(pos.value, sortF.type);
          conditions.push(
            sortF.dir === 'desc'
              ? sql`(${col} < ${val} OR (${col} = ${val} AND ${table.id} < ${pos.id}))`
              : sql`(${col} > ${val} OR (${col} = ${val} AND ${table.id} > ${pos.id}))`,
          );
        } else {
          conditions.push(sql`${table.id} > ${pos.id}`);
        }
      }

      // ORDER BY <sort?> , id  (id is the stable tiebreaker).
      const orderBy: SQL[] = [];
      if (sortF) {
        const col = resolveFieldExpr(table, sortF.field, sortF.type);
        orderBy.push(sortF.dir === 'desc' ? desc(col) : asc(col));
      }
      orderBy.push(asc(table.id));

      const fetched = (await db
        .select()
        .from(table as PgTable)
        .where(and(...conditions))
        .orderBy(...orderBy)
        .limit(take + 1)) as Row[];

      let nextCursor: string | null = null;
      if (fetched.length > take) {
        const last = fetched[take - 1] as Record<string, unknown>;
        nextCursor = encodeCursor({
          value: sortF ? rowSortValue(last, sortF.field) : null,
          id: last.id as string,
        });
        fetched.length = take;
      }
      return { rows: fetched, nextCursor };
    },
  };
}

export type RecordRepository<T extends RecordTable> = ReturnType<typeof createRecordRepository<T>>;
