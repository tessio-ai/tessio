// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Community stub for @tessio/ee-web. The Vite build aliases @tessio/ee-web to
 * this module in non-enterprise editions so the commercial enterprise UI is
 * never bundled into a Community build. These render nothing — the screens are
 * already hidden by the entitlement gate in Settings.tsx — but they keep the
 * lazy import resolvable.
 */
export function SsoSettings() {
  return null;
}
export function AuditLog() {
  return null;
}
