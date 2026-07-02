// SPDX-License-Identifier: AGPL-3.0-only

import { request } from './client';
import type { Entitlements } from '@tessio/entitlements';

/** Edition + per-feature entitlements for the current instance. */
export const getEntitlements = () => request<Entitlements>('/me/entitlements');
