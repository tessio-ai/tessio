// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod';

// ── Queues (consumed by the worker; published by the API) ───────────────────
export const NOTIFICATIONS_QUEUE = 'notifications';
export const EMAIL_SEND_QUEUE = 'email-send';
export const EMAIL_POLL_QUEUE = 'email-poll';

/** Reuses the workflow event shape: { eventType, recordId, changes?, internal? }. */
export interface NotificationEventJob {
  orgId: string;
  event: { eventType: string; recordId: string; actorId?: string | null; internal?: boolean; changes?: Record<string, unknown> };
}
export interface EmailSendJob {
  orgId: string;
  /** Team whose address should be used as the From (falls back to org settings). */
  teamId?: string | null;
  to: string;
  subject: string;
  text: string;
  html: string;
  headers?: Record<string, string>;
}

// ── Notification preferences (jsonb on users) ───────────────────────────────
export const notificationPrefsSchema = z.object({
  emailEnabled: z.boolean().default(true),
  assigned: z.boolean().default(true),
  replies: z.boolean().default(true),
  statusChanges: z.boolean().default(true),
});
export type NotificationPrefs = z.infer<typeof notificationPrefsSchema>;
export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = { emailEnabled: true, assigned: true, replies: true, statusChanges: true };

export const notificationType = z.enum(['assigned', 'reply', 'status']);
export type NotificationType = z.infer<typeof notificationType>;

/** The pref toggle that governs each notification type. */
export const PREF_FOR_TYPE: Record<NotificationType, keyof Omit<NotificationPrefs, 'emailEnabled'>> = {
  assigned: 'assigned',
  reply: 'replies',
  status: 'statusChanges',
};

// ── Email settings (shared between API validation and worker) ───────────────
export const emailSettingsInput = z.object({
  enabled: z.boolean().optional(),
  smtpHost: z.string().optional(),
  smtpPort: z.number().int().positive().max(65535).optional(),
  smtpSecure: z.boolean().optional(),
  smtpUser: z.string().optional(),
  smtpPassword: z.string().optional(), // write-only; encrypted server-side
  fromName: z.string().optional(),
  fromAddress: z.string().email().optional(),
  replyTo: z.string().email().nullable().optional(),
  inboundEnabled: z.boolean().optional(),
  imapHost: z.string().optional(),
  imapPort: z.number().int().positive().max(65535).optional(),
  imapSecure: z.boolean().optional(),
  imapUser: z.string().optional(),
  imapPassword: z.string().optional(), // write-only
  mailbox: z.string().optional(),
  acceptNewSenders: z.boolean().optional(),
  defaultSchemaId: z.string().uuid().nullable().optional(),
  defaultTeamId: z.string().uuid().nullable().optional(),
});
export type EmailSettingsInput = z.infer<typeof emailSettingsInput>;

// ── Message-ID threading ────────────────────────────────────────────────────
const TICKET_MID = /tkt-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-/i;

export function encodeTicketMessageId(ticketId: string, domain: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `<tkt-${ticketId}-${rand}@${domain}>`;
}

/** Scan In-Reply-To / References values for the first ticket id we encoded. */
export function parseTicketIdFromHeaders(headerValues: string[]): string | null {
  for (const v of headerValues) {
    const m = v.match(TICKET_MID);
    if (m) return m[1].toLowerCase();
  }
  return null;
}
