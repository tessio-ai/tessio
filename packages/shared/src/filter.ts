// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod';

/** Comparison operators usable in a filter leaf. */
export const comparisonOp = z.enum([
  'eq',
  'ne',
  'lt',
  'lte',
  'gt',
  'gte',
  'in',
  'contains',
  'startsWith',
  'isNull',
]);
export type ComparisonOp = z.infer<typeof comparisonOp>;

/** Type hint used to cast JSONB (`data.*`) values, and to bind sort/keyset values. */
export const fieldValueType = z.enum(['text', 'number', 'boolean', 'date']);
export type FieldValueType = z.infer<typeof fieldValueType>;

/**
 * A single condition. `field` is either a system column's property name
 * (e.g. "status", "assigneeId") or a JSONB custom field as "data.<key>".
 * `type` casts JSONB values (default text). `value` is unused for `isNull`,
 * and must be an array for `in`.
 */
export const filterLeaf = z.object({
  field: z.string().min(1),
  op: comparisonOp,
  value: z.unknown().optional(),
  type: fieldValueType.optional(),
});
export type FilterLeaf = z.infer<typeof filterLeaf>;

/** Recursive boolean tree of leaves. */
export type FilterNode =
  | FilterLeaf
  | { and: FilterNode[] }
  | { or: FilterNode[] }
  | { not: FilterNode };

export const filterNode: z.ZodType<FilterNode> = z.lazy(() =>
  z.union([
    z.object({ and: z.array(filterNode).min(1) }),
    z.object({ or: z.array(filterNode).min(1) }),
    z.object({ not: filterNode }),
    filterLeaf,
  ]),
);

export const sortDir = z.enum(['asc', 'desc']);
export type SortDir = z.infer<typeof sortDir>;

/** A single sort key (the query layer supports one sort field + the id tiebreaker). */
export const sortField = z.object({
  field: z.string().min(1),
  dir: sortDir.default('asc'),
  type: fieldValueType.optional(),
});
export type SortField = z.infer<typeof sortField>;
