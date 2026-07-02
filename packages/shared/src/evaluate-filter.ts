// SPDX-License-Identifier: AGPL-3.0-only

import type { FilterNode, FilterLeaf } from './filter';
import { getPath } from './interpolate';

function compare(op: FilterLeaf['op'], left: unknown, right: unknown): boolean {
  switch (op) {
    case 'eq':
      return left === right;
    case 'ne':
      return left !== right;
    case 'lt':
      return (left as number) < (right as number);
    case 'lte':
      return (left as number) <= (right as number);
    case 'gt':
      return (left as number) > (right as number);
    case 'gte':
      return (left as number) >= (right as number);
    case 'in':
      return Array.isArray(right) && right.includes(left);
    case 'contains':
      return String(left ?? '').includes(String(right));
    case 'startsWith':
      return String(left ?? '').startsWith(String(right));
    case 'isNull':
      return left === null || left === undefined;
  }
}

/**
 * Evaluate a filter AST against an in-memory record (flat key -> value).
 * Used for form `visibleWhen` (spec 7.1); the same AST is compiled to SQL by @tessio/db.
 */
export function evaluateFilter(node: FilterNode, record: Record<string, unknown>): boolean {
  if ('and' in node) return node.and.every((n) => evaluateFilter(n, record));
  if ('or' in node) return node.or.some((n) => evaluateFilter(n, record));
  if ('not' in node) return !evaluateFilter(node.not, record);
  return compare(node.op, record[node.field], node.value);
}

/**
 * Same AST, but leaf `field` is a dot path resolved into a nested scope object
 * (e.g. "ticket.data.category", "nodes.http.output.status"). Used by workflow
 * trigger conditions and branch-edge conditions (spec 5.4).
 */
export function evaluateFilterDeep(node: FilterNode, scope: unknown): boolean {
  if ('and' in node) return node.and.every((n) => evaluateFilterDeep(n, scope));
  if ('or' in node) return node.or.some((n) => evaluateFilterDeep(n, scope));
  if ('not' in node) return !evaluateFilterDeep(node.not, scope);
  return compare(node.op, getPath(scope, node.field), node.value);
}
