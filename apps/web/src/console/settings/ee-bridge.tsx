// SPDX-License-Identifier: AGPL-3.0-only

/*
 * Composition seam for the commercial Enterprise web UI. This is the ONLY place
 * core (apps/web) references @tessio/ee-web, and it does so via a lazy dynamic
 * import that the Vite build aliases to a stub in Community editions (see
 * vite.config.ts) — so the enterprise bundle never ships in Community. The
 * import boundary lint only flags STATIC imports, so the dynamic import below is
 * the sanctioned escape hatch — no static reference to @tessio/ee-web exists in
 * core. See LICENSING.md.
 */
import { lazy, Suspense } from 'react';
import { EeHostProvider, type EeHost } from '@tessio/web-ee-host';
import { Button, relTime, absTime } from '../ui';
import { Icon } from '../icons';
import { request } from '../../api/client';

const host: EeHost = {
  Button: Button as unknown as EeHost['Button'],
  Icon: Icon as unknown as EeHost['Icon'],
  relTime,
  absTime,
  request,
};

const LazySsoSettings = lazy(() => import('@tessio/ee-web').then((m) => ({ default: m.SsoSettings })));
const LazyAuditLog = lazy(() => import('@tessio/ee-web').then((m) => ({ default: m.AuditLog })));

const Loading = () => <div className="page-pad muted">Loading…</div>;

export function EeSsoSettings() {
  return (
    <EeHostProvider host={host}>
      <Suspense fallback={<Loading />}>
        <LazySsoSettings />
      </Suspense>
    </EeHostProvider>
  );
}

export function EeAuditLog() {
  return (
    <EeHostProvider host={host}>
      <Suspense fallback={<Loading />}>
        <LazyAuditLog />
      </Suspense>
    </EeHostProvider>
  );
}
