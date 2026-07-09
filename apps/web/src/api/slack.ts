// SPDX-License-Identifier: AGPL-3.0-only

import { request } from './client';

export interface SlackSettingsView {
  orgId: string;
  enabled: boolean;
  webhookConfigured: boolean;
  notifyCreated: boolean;
  notifyAssigned: boolean;
  notifyStatus: boolean;
  notifyCommented: boolean;
  notifySlaBreach: boolean;
}

export interface UpdateSlackSettingsInput {
  enabled?: boolean;
  webhookUrl?: string;
  notifyCreated?: boolean;
  notifyAssigned?: boolean;
  notifyStatus?: boolean;
  notifyCommented?: boolean;
  notifySlaBreach?: boolean;
}

export const getSlackSettings = () => request<SlackSettingsView>('/slack-settings');
export const putSlackSettings = (patch: UpdateSlackSettingsInput) =>
  request<SlackSettingsView>('/slack-settings', { method: 'PUT', body: JSON.stringify(patch) });
export const testSlack = () =>
  request<{ ok: boolean }>('/slack-settings/test', { method: 'POST' });
