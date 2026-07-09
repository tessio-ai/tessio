// SPDX-License-Identifier: AGPL-3.0-only

import {
  interpolateDeep,
  HTTP_TIMEOUT_DEFAULT_MS,
  HTTP_TIMEOUT_MAX_MS,
  HTTP_BODY_MAX_BYTES,
  SCRIPT_TIMEOUT_DEFAULT_MS,
  SCRIPT_TIMEOUT_MAX_MS,
  type HttpAuthConfig,
  type WorkflowNode,
  type WorkflowScope,
} from '@tessio/shared';
import { assertPublicUrl } from './ssrf';

/** Build the auth header(s) for an http node from its `auth` config + resolved secrets. */
export function buildAuthHeaders(auth: HttpAuthConfig | undefined, secrets: Record<string, string>): Record<string, string> {
  if (!auth || auth.type === 'none') return {};
  const value = secrets[auth.secret];
  if (value === undefined) throw new Error(`secret "${auth.secret}" is not defined`);
  switch (auth.type) {
    case 'bearer':
      return { Authorization: `Bearer ${value}` };
    case 'basic':
      return { Authorization: `Basic ${Buffer.from(`${auth.username}:${value}`).toString('base64')}` };
    case 'apiKey':
      return { [auth.header]: value };
  }
}

/** Side effects a node may perform — wired to real repos/fetch/runner in index.ts. */
export interface NodeExecDeps {
  /** Apply a field patch to the run's ticket; returns the fresh row + the fields written. */
  updateTicket(
    ticketId: string,
    set: { status?: string; priority?: string; assigneeId?: string; teamId?: string; parentId?: string; data?: Record<string, unknown> },
  ): Promise<{ ticket: Record<string, unknown>; updated: string[] }>;
  /** Create a child ticket under `parentId` (inherits the parent's schema); returns the new row's id + number. */
  createSubtask(
    parentId: string,
    fields: { title: string; description?: string; priority?: string; assigneeId?: string; teamId?: string; status?: string; data?: Record<string, unknown> },
  ): Promise<{ ticketId: string; number: number }>;
  addComment(ticketId: string, body: string, internal: boolean): Promise<{ commentId: string }>;
  fetchFn: typeof fetch;
  runScript(code: string, ctx: unknown, timeoutMs: number): Promise<unknown>;
  /** Post to the org's connected Slack integration; throws when it isn't configured. */
  sendSlack(text: string): Promise<void>;
}

/**
 * The interpolated config — recorded as the node run's `input` before execution.
 * Script code is exempt: it reads run data from `ctx`, and `{{ }}` would collide
 * with legitimate JavaScript.
 */
export function prepareNodeInput(node: WorkflowNode, scope: WorkflowScope): unknown {
  if (node.type === 'script') return node.config;
  return interpolateDeep(node.config, scope);
}

function ticketId(scope: WorkflowScope): string {
  const id = scope.ticket?.id;
  if (typeof id !== 'string') throw new Error('This run has no subject ticket.');
  return id;
}

/** 3xx statuses we follow manually so the SSRF guard re-runs on every hop. */
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECTS = 5;

/** Drop credentials that must not follow a redirect to a different origin. */
function withoutCredentialHeaders(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).filter(([k]) => {
      const lk = k.toLowerCase();
      return lk !== 'authorization' && lk !== 'cookie';
    }),
  );
}

/**
 * Fetch `startUrl`, following redirects ourselves so {@link assertPublicUrl} runs
 * against EVERY hop. Native fetch defaults to `redirect: 'follow'`, which would
 * chase a 30x `Location` into an internal address (cloud metadata, Postgres/Redis,
 * the runner) once the initial URL had passed the guard — the exact SSRF the guard
 * exists to stop. We drive the chain so each target is validated before connecting,
 * and drop Authorization/Cookie on a cross-origin hop so a configured secret can't
 * leak to a redirect target.
 *
 * (A hostname re-pointed to a private IP between this check and the socket connect —
 * DNS rebinding — remains the same pre-existing residual noted in ssrf.ts.)
 */
async function fetchGuarded(
  fetchFn: typeof fetch,
  startUrl: string,
  init: { method: string; headers: Record<string, string>; body?: string },
  signal: AbortSignal,
): Promise<Response> {
  let url = startUrl;
  let method = init.method;
  let headers = init.headers;
  let body = init.body;

  for (let hop = 0; ; hop++) {
    await assertPublicUrl(url);
    const res = await fetchFn(url, {
      method,
      headers,
      body: method === 'GET' || method === 'HEAD' ? undefined : body,
      signal,
      redirect: 'manual',
    });

    const location = res.headers.get('location');
    if (!REDIRECT_STATUSES.has(res.status) || !location) return res;
    if (hop >= MAX_REDIRECTS) throw new Error('Too many redirects.');

    const next = new URL(location, url);
    if (next.origin !== new URL(url).origin) headers = withoutCredentialHeaders(headers);
    // Mirror fetch's own method demotion: 303 always becomes GET; 301/302 demote an
    // unsafe method to GET. 307/308 preserve the method and body.
    if (res.status === 303 || ((res.status === 301 || res.status === 302) && method !== 'GET' && method !== 'HEAD')) {
      method = 'GET';
      body = undefined;
    }
    url = next.toString();
  }
}

/**
 * Execute one action/code node against its interpolated input. Throws on failure
 * (the engine records the node run as failed and fails the run). `update_ticket`
 * refreshes `scope.ticket` so downstream templates see the new values.
 */
export async function executeNode(
  node: WorkflowNode,
  input: unknown,
  scope: WorkflowScope,
  deps: NodeExecDeps,
  secrets: Record<string, string> = {},
): Promise<{ output: unknown }> {
  switch (node.type) {
    case 'update_ticket': {
      const { set } = input as { set: Record<string, unknown> };
      const patch: Record<string, unknown> = {};
      for (const key of ['status', 'priority', 'assigneeId', 'teamId', 'parentId', 'data'] as const) {
        if (set?.[key] !== undefined && set[key] !== '') patch[key] = set[key];
      }
      if (Object.keys(patch).length === 0) return { output: { updated: [] } };
      const { ticket, updated } = await deps.updateTicket(ticketId(scope), patch);
      scope.ticket = ticket;
      return { output: { updated } };
    }

    case 'create_subtask': {
      const cfg = input as Record<string, unknown>;
      const fields: { title: string; description?: string; priority?: string; assigneeId?: string; teamId?: string; status?: string; data?: Record<string, unknown> } = {
        title: typeof cfg.title === 'string' ? cfg.title : '',
      };
      for (const key of ['description', 'priority', 'assigneeId', 'teamId', 'status'] as const) {
        if (cfg[key] !== undefined && cfg[key] !== '') fields[key] = cfg[key] as string;
      }
      if (cfg.data && typeof cfg.data === 'object') fields.data = cfg.data as Record<string, unknown>;
      const { ticketId: subtaskId, number } = await deps.createSubtask(ticketId(scope), fields);
      return { output: { ticketId: subtaskId, number } };
    }

    case 'add_comment': {
      const { body, internal } = input as { body: string; internal?: boolean };
      const { commentId } = await deps.addComment(ticketId(scope), body, internal ?? false);
      return { output: { commentId } };
    }

    case 'http_request': {
      const cfg = input as { method: string; url: string; headers?: Record<string, string>; body?: string; timeoutMs?: number; auth?: HttpAuthConfig };
      const timeout = Math.min(cfg.timeoutMs ?? HTTP_TIMEOUT_DEFAULT_MS, HTTP_TIMEOUT_MAX_MS);
      const authHeaders = buildAuthHeaders(cfg.auth, secrets);
      const authKeysLower = new Set(Object.keys(authHeaders).map((k) => k.toLowerCase()));
      const baseHeaders = Object.fromEntries(
        Object.entries(cfg.headers ?? {}).filter(([k]) => !authKeysLower.has(k.toLowerCase())),
      );
      const headers = { ...baseHeaders, ...authHeaders };
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      try {
        // The SSRF guard runs inside fetchGuarded against EVERY redirect hop, not
        // just the initial URL (workflow nodes run with the worker's network access).
        const res = await fetchGuarded(
          deps.fetchFn,
          cfg.url,
          { method: cfg.method, headers, body: cfg.body },
          controller.signal,
        );
        const text = (await res.text()).slice(0, HTTP_BODY_MAX_BYTES);
        let body: unknown = text;
        try {
          body = JSON.parse(text);
        } catch {
          // not JSON — keep the (truncated) text
        }
        // A non-2xx response is data, not a node failure — branch on output.ok downstream.
        return { output: { status: res.status, ok: res.ok, headers: Object.fromEntries(res.headers.entries()), body } };
      } finally {
        clearTimeout(timer);
      }
    }

    case 'slack_message': {
      const { text } = input as { text: string };
      await deps.sendSlack(text);
      return { output: { ok: true } };
    }

    case 'script': {
      const cfg = input as { code: string; timeoutMs?: number };
      const timeout = Math.min(cfg.timeoutMs ?? SCRIPT_TIMEOUT_DEFAULT_MS, SCRIPT_TIMEOUT_MAX_MS);
      // The raw (uninterpolated) code runs; scripts read values from ctx instead of templates.
      const output = await deps.runScript(node.config.code, {
        trigger: scope.trigger,
        ticket: scope.ticket,
        nodes: scope.nodes,
        run: scope.run,
      }, timeout);
      return { output };
    }

    default:
      throw new Error(`Node type "${node.type}" is not executable.`);
  }
}
