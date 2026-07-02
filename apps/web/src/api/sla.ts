// SPDX-License-Identifier: AGPL-3.0-only

import { request } from './client';

export interface SlaTarget {
  responseMins: number;
  resolutionMins: number;
}

export interface SlaSettingsView {
  enabled: boolean;
  targets: Record<string, SlaTarget>;
}

export interface UpdateSlaSettingsInput {
  enabled: boolean;
  targets: Record<string, SlaTarget>;
}

export const getSlaSettings = () => request<SlaSettingsView>('/sla-settings');
export const putSlaSettings = (body: UpdateSlaSettingsInput) =>
  request<SlaSettingsView>('/sla-settings', { method: 'PUT', body: JSON.stringify(body) });
