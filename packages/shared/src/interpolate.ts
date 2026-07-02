// SPDX-License-Identifier: AGPL-3.0-only

/**
 * `{{ path.dot.notation }}` interpolation for workflow node configs (spec 5.4).
 * Distinct from `resolveTemplate` ({token} single-key, used for asset naming):
 * these templates resolve dot paths into the run scope and a template that is
 * exactly one expression yields the raw value (type-preserving).
 */

const EXPR = /\{\{\s*([a-zA-Z0-9_$]+(?:\.[a-zA-Z0-9_$]+)*)\s*\}\}/g;

/** Null-safe nested lookup: getPath({a:{b:1}}, 'a.b') === 1. */
export function getPath(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const seg of path.split('.')) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

function stringify(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/**
 * Resolve `{{ path }}` expressions in a template against `scope`. A template that
 * is exactly one expression returns the raw resolved value; otherwise expressions
 * stringify in place (objects as JSON, missing paths as ''). Non-strings pass through.
 */
export function interpolate(template: string, scope: unknown): unknown {
  if (typeof template !== 'string') return template;
  const single = template.match(/^\{\{\s*([a-zA-Z0-9_$]+(?:\.[a-zA-Z0-9_$]+)*)\s*\}\}$/);
  if (single) return getPath(scope, single[1]);
  return template.replace(EXPR, (_m, path: string) => stringify(getPath(scope, path)));
}

/** Recursively interpolate every string inside a config object/array. */
export function interpolateDeep<T>(value: T, scope: unknown): T {
  if (typeof value === 'string') return interpolate(value, scope) as T;
  if (Array.isArray(value)) return value.map((v) => interpolateDeep(v, scope)) as T;
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, interpolateDeep(v, scope)]),
    ) as T;
  }
  return value;
}
