// SPDX-License-Identifier: AGPL-3.0-only

import { request } from './client';

export interface EmailSettingsView {
  orgId: string;
  enabled: boolean;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean;
  smtpUser: string | null;
  smtpConfigured: boolean;
  fromName: string | null;
  fromAddress: string | null;
  replyTo: string | null;
  inboundEnabled: boolean;
  imapHost: string | null;
  imapPort: number | null;
  imapSecure: boolean;
  imapUser: string | null;
  imapConfigured: boolean;
  mailbox: string;
  acceptNewSenders: boolean;
  defaultSchemaId: string | null;
  defaultTeamId: string | null;
}

export interface UpdateEmailSettingsInput {
  enabled?: boolean;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string;
  smtpPassword?: string;
  fromName?: string;
  fromAddress?: string;
  replyTo?: string | null;
  inboundEnabled?: boolean;
  imapHost?: string;
  imapPort?: number;
  imapSecure?: boolean;
  imapUser?: string;
  imapPassword?: string;
  mailbox?: string;
  acceptNewSenders?: boolean;
  defaultSchemaId?: string | null;
  defaultTeamId?: string | null;
}

export const getEmailSettings = () => request<EmailSettingsView>('/email-settings');
export const putEmailSettings = (patch: UpdateEmailSettingsInput) =>
  request<EmailSettingsView>('/email-settings', { method: 'PUT', body: JSON.stringify(patch) });
export const testSmtp = () =>
  request<{ ok: boolean }>('/email-settings/test-smtp', { method: 'POST' });
