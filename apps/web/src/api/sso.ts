// SPDX-License-Identifier: AGPL-3.0-only

import { BASE_URL } from './client';

export interface SsoInfo {
  enabled: boolean;
  buttonLabel: string;
}

/**
 * Public — no auth required. Hits /api/v1/auth/sso/info directly to avoid auth
 * middleware. In the Community edition the SSO route does not exist, so this
 * resolves to 404 and the login page simply shows no SSO button.
 */
export async function getSsoInfo(): Promise<SsoInfo> {
  const res = await fetch(`${BASE_URL}/auth/sso/info`);
  if (!res.ok) throw new Error('SSO info unavailable');
  return (await res.json()) as SsoInfo;
}
