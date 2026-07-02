// SPDX-License-Identifier: AGPL-3.0-only

import type { WorkflowGraph } from './workflow';

/** Secret names are restricted so they're safe inside `{{ secrets.<name> }}`. */
export const SECRET_NAME_RE = /^[a-z0-9_]+$/;

const SECRET_EXPR = /\{\{\s*secrets\.([a-z0-9_]+)\s*\}\}/g;

/**
 * A scope `secrets` value used during the RECORDED interpolation pass: every access
 * returns the literal placeholder, so `{{ secrets.x }}` survives verbatim into the
 * persisted node input instead of resolving to a value (or to '').
 */
export function redactedSecretsScope(): Record<string, string> {
  return new Proxy(
    {},
    // Symbol keys (Symbol.iterator, Symbol.toPrimitive, …) must not be coerced into
    // a template — only string secret names produce a placeholder.
    { get: (_t, name: string | symbol) => (typeof name === 'symbol' ? undefined : `{{ secrets.${name} }}`) },
  ) as Record<string, string>;
}

/** Names referenced as `{{ secrets.x }}` in a string. */
function refsInString(s: string, into: Set<string>): void {
  for (const m of s.matchAll(SECRET_EXPR)) into.add(m[1]);
}

/**
 * Execution-only pass: replace `{{ secrets.<name> }}` in an already-interpolated input
 * with real values. Throws if a referenced secret is absent. Used on a copy that is
 * never persisted.
 */
export function resolveSecrets<T>(input: T, secrets: Record<string, string>): T {
  if (typeof input === 'string') {
    return input.replace(SECRET_EXPR, (_m, name: string) => {
      if (!(name in secrets)) throw new Error(`secret "${name}" is not defined`);
      return secrets[name];
    }) as unknown as T;
  }
  if (Array.isArray(input)) return input.map((v) => resolveSecrets(v, secrets)) as unknown as T;
  if (input !== null && typeof input === 'object') {
    return Object.fromEntries(
      Object.entries(input as Record<string, unknown>).map(([k, v]) => [k, resolveSecrets(v, secrets)]),
    ) as T;
  }
  return input;
}

/** All secret names a graph references (templates + http `auth.secret`). */
export function collectSecretRefs(graph: WorkflowGraph): string[] {
  const names = new Set<string>();
  const walk = (v: unknown): void => {
    if (typeof v === 'string') refsInString(v, names);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  for (const node of graph.nodes) {
    walk(node.config);
    if (node.type === 'http_request') {
      const auth = (node.config as { auth?: { secret?: string } }).auth;
      if (auth?.secret) names.add(auth.secret);
    }
  }
  return [...names];
}
