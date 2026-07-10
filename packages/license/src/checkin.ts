// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Client-side license check-in — what runs inside a customer's Tessio instance.
 *
 * The customer sets ONE stable, opaque token (`TESSIO_LICENSE_KEY`) and never
 * touches it again. This module trades that opaque token for a short-lived,
 * cryptographically-signed *entitlement* token by calling the vendor's license
 * server, caches it to disk, and re-checks daily. Renewal is automatic: the
 * customer's token doesn't change, the server's answer does (driven by Stripe).
 *
 * Offline behaviour, by design:
 *   - If `TESSIO_LICENSE_KEY` is itself a signed token (an air-gap license minted
 *     by the CLI), there is no server to call — it is used directly, forever.
 *   - If a check-in fails, the last cached entitlement keeps the instance running
 *     until that token's own TTL lapses. The server sets the TTL (e.g. 14 days),
 *     so the TTL *is* the offline grace window. This is the only reason a Tessio
 *     instance ever contacts the vendor, and it sends a token, never usage data.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { isSignedToken } from './format';

export interface CheckInResponse {
  /** The freshly-signed entitlement token. */
  token: string;
}

export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

export interface LicenseClientOptions {
  /** The customer's stable token — opaque (hosted) or a signed offline token. */
  storeToken: string | undefined;
  /** License-server check-in URL, e.g. https://license.tessio.ai/license/check-in. */
  checkInUrl: string | undefined;
  /** Where to cache the last good entitlement token. */
  cachePath: string;
  /** Injectable HTTP (defaults to global fetch), fs, and clock — for testing. */
  fetchImpl?: FetchLike;
  readCache?: (path: string) => string | undefined;
  writeCache?: (path: string, token: string) => void;
}

export type ResolveSource = 'offline' | 'checkin' | 'cache' | 'none';

export interface ResolvedToken {
  /** The signed token to hand to resolveEffectiveEdition, if any. */
  signedToken?: string;
  source: ResolveSource;
  /** Set when nothing usable was found / check-in failed with no cache. */
  reason?: string;
}

const defaultReadCache = (path: string): string | undefined => {
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as { token?: unknown };
    return typeof parsed.token === 'string' ? parsed.token : undefined;
  } catch {
    return undefined; // missing / unreadable / bad JSON → treat as no cache
  }
};

const defaultWriteCache = (path: string, token: string): void => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify({ token }), 'utf8');
};

export function createLicenseClient(opts: LicenseClientOptions) {
  const read = opts.readCache ?? defaultReadCache;
  const write = opts.writeCache ?? defaultWriteCache;
  const doFetch = opts.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);

  /** One check-in round-trip. Returns the signed token, or an error reason. */
  async function refreshOnce(): Promise<{ token: string } | { error: string }> {
    if (!opts.storeToken) return { error: 'no license key configured' };
    if (!opts.checkInUrl) return { error: 'no license server URL configured' };
    try {
      const res = await doFetch(opts.checkInUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: opts.storeToken }),
      });
      if (!res.ok) return { error: `license server responded ${res.status}` };
      const body = (await res.json()) as Partial<CheckInResponse>;
      if (!isSignedToken(body.token)) return { error: 'license server returned no valid token' };
      write(opts.cachePath, body.token);
      return { token: body.token };
    } catch (err) {
      return { error: `license server unreachable: ${(err as Error).message}` };
    }
  }

  /**
   * Resolve the best available signed token at boot:
   *   offline signed token  → use directly (no network)
   *   opaque token          → check in; on failure fall back to the disk cache
   */
  async function resolveInitial(): Promise<ResolvedToken> {
    if (!opts.storeToken) return { source: 'none', reason: 'no license key configured' };

    // Air-gap: the provided key is already a signed token — trust it as-is.
    if (isSignedToken(opts.storeToken)) return { signedToken: opts.storeToken, source: 'offline' };

    // Hosted: exchange the opaque token for a fresh entitlement.
    const fresh = await refreshOnce();
    if ('token' in fresh) return { signedToken: fresh.token, source: 'checkin' };

    // Check-in failed — fall back to the last cached entitlement (offline grace).
    const cached = read(opts.cachePath);
    if (cached) return { signedToken: cached, source: 'cache', reason: fresh.error };
    return { source: 'none', reason: fresh.error };
  }

  /**
   * Start the daily refresh loop (hosted tokens only). Each successful check-in
   * writes the cache and calls `onRefresh` with the new token so the caller can
   * re-apply the resolved edition. The timer is `unref`'d so it never keeps the
   * process alive. Returns a stop() function.
   */
  function startDailyRefresh(onRefresh: (token: string) => void, intervalMs = 24 * 60 * 60 * 1000): () => void {
    if (!opts.storeToken || isSignedToken(opts.storeToken) || !opts.checkInUrl) {
      return () => {}; // nothing to refresh for offline / unconfigured setups
    }
    const timer = setInterval(() => {
      void refreshOnce().then((r) => {
        if ('token' in r) onRefresh(r.token);
      });
    }, intervalMs);
    (timer as { unref?: () => void }).unref?.();
    return () => clearInterval(timer);
  }

  return { refreshOnce, resolveInitial, startDailyRefresh };
}
