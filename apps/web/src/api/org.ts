// SPDX-License-Identifier: AGPL-3.0-only

import { request } from './client';

export interface OrgRow {
  id: string;
  name: string;
  slug: string;
}

export const getOrg = () => request<OrgRow>('/org');
export const updateOrg = (patch: { name: string }) =>
  request<OrgRow>('/org', { method: 'PATCH', body: JSON.stringify(patch) });
