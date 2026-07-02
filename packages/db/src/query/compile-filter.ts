// SPDX-License-Identifier: AGPL-3.0-only

import { and, or, not, sql, getTableColumns, type SQL } from 'drizzle-orm';
import type { FilterNode, FilterLeaf, FieldValueType } from '@tessio/shared';
import type { RecordTable } from '../repositories/records';

const JSONB_KEY_RE = /^[a-zA-Z0-9_]+$/;
const DATA_PREFIX = 'data.';

/** Postgres cast suffix for a JSONB value type (text needs none). Exported for reuse. */
export function castSuffix(type: FieldValueType | undefined): string {
  switch (type) {
    case 'number':
      return '::numeric';
    case 'boolean':
      return '::boolean';
    case 'date':
      return '::timestamptz';
    default:
      return '';
  }
}

/**
 * Resolve a field name to a SQL scalar expression. Exported and reused by the
 * repository's sort/keyset logic so the resolution + safety rules live in one place.
 * - "data.<key>"  -> (data ->> 'key') with optional cast (key sanitized)
 * - "<column>"    -> the real column (must exist on the table)
 * Throws on unknown columns or unsafe JSONB keys — no identifier interpolation.
 */
export function resolveFieldExpr(
  table: RecordTable,
  field: string,
  type: FieldValueType | undefined,
): SQL {
  if (field.startsWith(DATA_PREFIX)) {
    const key = field.slice(DATA_PREFIX.length);
    if (!JSONB_KEY_RE.test(key)) throw new Error(`Invalid JSONB field key: ${field}`);
    const suffix = castSuffix(type);
    return suffix ? sql`(${table.data} ->> ${key})${sql.raw(suffix)}` : sql`(${table.data} ->> ${key})`;
  }
  const columns = getTableColumns(table) as Record<string, unknown>;
  const column = columns[field];
  if (!column) throw new Error(`Unknown field: ${field}`);
  return sql`${column}`;
}

/** Cast a bound value to match a JSONB type (so numeric/date comparisons work). Exported for reuse. */
export function castedValue(value: unknown, type: FieldValueType | undefined): SQL {
  const suffix = castSuffix(type);
  return suffix ? sql`${value}${sql.raw(suffix)}` : sql`${value}`;
}

function compileLeaf(table: RecordTable, leaf: FilterLeaf): SQL {
  const left = resolveFieldExpr(table, leaf.field, leaf.type);
  switch (leaf.op) {
    case 'eq':
      return sql`${left} = ${castedValue(leaf.value, leaf.type)}`;
    case 'ne':
      return sql`${left} <> ${castedValue(leaf.value, leaf.type)}`;
    case 'lt':
      return sql`${left} < ${castedValue(leaf.value, leaf.type)}`;
    case 'lte':
      return sql`${left} <= ${castedValue(leaf.value, leaf.type)}`;
    case 'gt':
      return sql`${left} > ${castedValue(leaf.value, leaf.type)}`;
    case 'gte':
      return sql`${left} >= ${castedValue(leaf.value, leaf.type)}`;
    case 'in': {
      const arr = Array.isArray(leaf.value) ? leaf.value : [];
      if (arr.length === 0) return sql`FALSE`;
      const elements = sql.join(
        arr.map((v) => castedValue(v, leaf.type)),
        sql`, `,
      );
      return sql`${left} IN (${elements})`;
    }
    case 'contains':
      return sql`${left} ILIKE ${'%' + String(leaf.value) + '%'}`;
    case 'startsWith':
      return sql`${left} ILIKE ${String(leaf.value) + '%'}`;
    case 'isNull':
      return sql`${left} IS NULL`;
  }
}

/** Compile a filter AST node to a Drizzle SQL condition. */
export function compileFilter(table: RecordTable, node: FilterNode): SQL {
  if ('and' in node) {
    const compiled = node.and.map((n) => compileFilter(table, n));
    return and(...compiled) as SQL;
  }
  if ('or' in node) {
    const compiled = node.or.map((n) => compileFilter(table, n));
    return or(...compiled) as SQL;
  }
  if ('not' in node) {
    return not(compileFilter(table, node.not));
  }
  return compileLeaf(table, node);
}
