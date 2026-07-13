// SPDX-License-Identifier: AGPL-3.0-only

import { request, BASE_URL } from './client';

export interface LoginSettingsRow {
  orgId: string;
  brandName: string;
  logo: string | null;
  headline: string;
  tagline: string;
  updatedAt: string;
}

export interface UpdateLoginSettingsInput {
  brandName?: string;
  /** data:image/* URL; empty string clears the logo. */
  logo?: string;
  headline?: string;
  tagline?: string;
}

export const getLoginSettings = () => request<LoginSettingsRow>('/login-settings');
export const updateLoginSettings = (patch: UpdateLoginSettingsInput) =>
  request<LoginSettingsRow>('/login-settings', { method: 'PATCH', body: JSON.stringify(patch) });

export interface LoginBranding {
  brandName: string;
  logo: string | null;
  headline: string;
  tagline: string;
  /** The workspace theme color (Settings → Branding) — tints the sign-in sky. */
  accent: string;
}

/** Public — no auth required; the sign-in screen calls this before any session exists. */
export async function getLoginBranding(): Promise<LoginBranding> {
  const res = await fetch(`${BASE_URL}/auth/login-branding`);
  if (!res.ok) throw new Error('login branding unavailable');
  return (await res.json()) as LoginBranding;
}
