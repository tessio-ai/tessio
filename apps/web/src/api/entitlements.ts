// SPDX-License-Identifier: AGPL-3.0-only

import { request } from './client';
import type { Entitlements } from '@tessio/entitlements';

/** The /me/entitlements payload: static entitlements + live seat usage. */
export type InstanceEntitlements = Entitlements & {
  /** Active admins + agents currently occupying billable seats. */
  seatsUsed: number;
};

/** Edition + per-feature entitlements + seat usage for the current instance. */
export const getEntitlements = () => request<InstanceEntitlements>('/me/entitlements');
