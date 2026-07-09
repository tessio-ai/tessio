// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod';

// ── Queue (consumed by the worker; published by the notifier/SLA tick) ──────
export const SLACK_SEND_QUEUE = 'slack-send';

/** A fully-rendered Slack message; the send consumer only resolves the webhook and posts. */
export interface SlackSendJob {
  orgId: string;
  text: string;
  blocks?: unknown[];
}

// ── Slack settings (shared between API validation, worker, and web) ─────────
export const slackSettingsInput = z.object({
  enabled: z.boolean().optional(),
  webhookUrl: z.string().optional(), // write-only; encrypted server-side
  notifyCreated: z.boolean().optional(),
  notifyAssigned: z.boolean().optional(),
  notifyStatus: z.boolean().optional(),
  notifyCommented: z.boolean().optional(),
  notifySlaBreach: z.boolean().optional(),
});
export type SlackSettingsInput = z.infer<typeof slackSettingsInput>;

/** Ticket activity events the Slack notifier announces, mapped to their settings toggle. */
export const SLACK_TOGGLE_FOR_EVENT = {
  created: 'notifyCreated',
  assigned: 'notifyAssigned',
  status: 'notifyStatus',
  commented: 'notifyCommented',
} as const;
export type SlackTicketEvent = keyof typeof SLACK_TOGGLE_FOR_EVENT;

export function isSlackTicketEvent(eventType: string): eventType is SlackTicketEvent {
  return eventType in SLACK_TOGGLE_FOR_EVENT;
}

/** Incoming webhooks are always https (Slack, Mattermost, Rocket.Chat alike). */
export function isValidSlackWebhookUrl(raw: string): boolean {
  try {
    return new URL(raw).protocol === 'https:';
  } catch {
    return false;
  }
}

/** Slack mrkdwn requires only &, < and > to be escaped. */
export function escapeSlackText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const EVENT_LEAD: Record<SlackTicketEvent, string> = {
  created: 'New ticket',
  assigned: 'Assignee changed',
  status: 'Status changed',
  commented: 'New reply',
};

export interface SlackTicketMessageInput {
  eventType: SlackTicketEvent;
  number: number;
  title: string;
  url: string;
  changes?: Record<string, unknown>;
  internal?: boolean;
}

export interface SlackMessage {
  text: string;
  blocks: unknown[];
}

function detailFor(m: SlackTicketMessageInput): string {
  if (m.eventType === 'status' && m.changes?.status) return `Status is now "${String(m.changes.status)}".`;
  if (m.eventType === 'commented' && m.internal) return 'A new internal note was added.';
  if (m.eventType === 'commented') return 'A new reply was posted.';
  if (m.eventType === 'assigned') return 'The ticket was reassigned.';
  return '';
}

/** Render one ticket event as a Block Kit message (with a plain-text fallback). */
export function buildSlackTicketMessage(m: SlackTicketMessageInput): SlackMessage {
  const lead = m.eventType === 'commented' && m.internal ? 'New internal note' : EVENT_LEAD[m.eventType];
  const title = escapeSlackText(m.title);
  const detail = detailFor(m);
  const text = `${lead}: #${m.number} ${m.title}${detail ? ` — ${detail}` : ''}`;
  return {
    text,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${lead}* · <${m.url}|#${m.number} ${title}>${detail ? `\n${escapeSlackText(detail)}` : ''}`,
        },
      },
    ],
  };
}

export interface SlackSlaMessageInput {
  number: number | null;
  kind: 'response' | 'resolution';
  url: string;
}

export function buildSlackSlaMessage(m: SlackSlaMessageInput): SlackMessage {
  const detail = m.kind === 'response' ? 'Response SLA breached.' : 'Resolution SLA breached.';
  const label = `#${m.number ?? '?'}`;
  return {
    text: `SLA breach: ${label} — ${detail}`,
    blocks: [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `:rotating_light: *SLA breach* · <${m.url}|${label}>\n${detail}` },
      },
    ],
  };
}

export function buildSlackTestMessage(): SlackMessage {
  return {
    text: 'Tessio Slack test — your webhook is working correctly.',
    blocks: [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: ':white_check_mark: *Tessio Slack test* — your webhook is working correctly.' },
      },
    ],
  };
}
