// SPDX-License-Identifier: AGPL-3.0-only

import {
  PREF_FOR_TYPE,
  buildSlackTicketMessage,
  isSlackTicketEvent,
  type NotificationEventJob,
  type NotificationPrefs,
  type SlackSendJob,
  type SlackTicketEvent,
} from '@tessio/shared';
import { resolveRecipients } from './resolve';
import { renderNotificationEmail } from '../email/templates';

export interface NotifyTicket { id: string; number: number; title: string; requesterId: string | null; assigneeId: string | null; }
export interface NotifyDeps {
  loadTicket(orgId: string, ticketId: string): Promise<NotifyTicket | null>;
  loadPrefs(orgId: string, userIds: string[]): Promise<Record<string, NotificationPrefs>>;
  loadEmail(userId: string): Promise<string | null>;
  createNotifications(rows: { orgId: string; userId: string; ticketId: string; type: string; title: string; snippet: string }[]): Promise<void>;
  enqueueEmail(job: { orgId: string; to: string; subject: string; text: string; html: string; headers?: Record<string, string> }): Promise<void>;
  orgEmailEnabled(orgId: string): Promise<boolean>;
  fromDomain(orgId: string): Promise<string>;
  /** Per-event Slack toggles, or null when the org's Slack integration is disabled. */
  orgSlack(orgId: string): Promise<Record<SlackTicketEvent, boolean> | null>;
  enqueueSlack(job: SlackSendJob): Promise<void>;
  siteUrl: string;
}

function snippetFor(eventType: string, changes?: Record<string, unknown>): string {
  if (eventType === 'commented') return 'You have a new reply.';
  if (eventType === 'assigned') return 'This ticket is now assigned to you.';
  return changes?.status ? `Status is now "${String(changes.status)}".` : 'The ticket was updated.';
}

export async function processNotificationEvent(job: NotificationEventJob, deps: NotifyDeps): Promise<void> {
  const ticket = await deps.loadTicket(job.orgId, job.event.recordId);
  if (!ticket) return;

  // Channel-level Slack post — independent of per-user recipients/prefs.
  if (isSlackTicketEvent(job.event.eventType)) {
    const slack = await deps.orgSlack(job.orgId);
    if (slack?.[job.event.eventType]) {
      const msg = buildSlackTicketMessage({
        eventType: job.event.eventType,
        number: ticket.number,
        title: ticket.title,
        url: `${deps.siteUrl}/#/tickets/${ticket.id}`,
        changes: job.event.changes,
        internal: job.event.internal ?? false,
      });
      await deps.enqueueSlack({ orgId: job.orgId, text: msg.text, blocks: msg.blocks });
    }
  }

  const recipients = resolveRecipients({
    eventType: job.event.eventType, actorId: job.event.actorId ?? null, internal: job.event.internal ?? false,
    requesterId: ticket.requesterId, assigneeId: ticket.assigneeId, changes: job.event.changes,
  });
  if (recipients.length === 0) return;

  const prefs = await deps.loadPrefs(job.orgId, recipients.map((r) => r.userId));
  const snippet = snippetFor(job.event.eventType, job.event.changes);
  await deps.createNotifications(recipients.map((r) => ({ orgId: job.orgId, userId: r.userId, ticketId: ticket.id, type: r.type, title: `#${ticket.number} ${ticket.title}`, snippet })));

  if (!(await deps.orgEmailEnabled(job.orgId))) return;
  const domain = await deps.fromDomain(job.orgId);
  for (const r of recipients) {
    const p = prefs[r.userId];
    if (!p || !p.emailEnabled || !p[PREF_FOR_TYPE[r.type]]) continue;
    const to = await deps.loadEmail(r.userId);
    if (!to) continue;
    const m = renderNotificationEmail({ type: r.type, snippet }, { ticket, fromDomain: domain, siteUrl: deps.siteUrl });
    await deps.enqueueEmail({ orgId: job.orgId, to, subject: m.subject, text: m.text, html: m.html, headers: { 'Message-ID': m.messageId } });
  }
}
