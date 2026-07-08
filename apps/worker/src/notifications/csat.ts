// SPDX-License-Identifier: AGPL-3.0-only

import { CSAT_TRIGGER_STATUSES, type NotificationEventJob } from '@tessio/shared';
import { renderCsatEmail } from '../email/templates';
import type { NotifyDeps, NotifyTicket } from './process';

export interface CsatDeps {
  loadTicket(orgId: string, ticketId: string): Promise<NotifyTicket | null>;
  loadCsatSettings(orgId: string): Promise<{ enabled: boolean; question: string | null }>;
  /** Insert the survey row; returns false when the ticket was already surveyed. */
  createSurvey(input: { orgId: string; ticketId: string; requesterId: string | null }): Promise<boolean>;
  loadPrefs: NotifyDeps['loadPrefs'];
  loadEmail: NotifyDeps['loadEmail'];
  enqueueEmail: NotifyDeps['enqueueEmail'];
  orgEmailEnabled: NotifyDeps['orgEmailEnabled'];
  fromDomain: NotifyDeps['fromDomain'];
  siteUrl: string;
}

const STATUS_EVENTS = new Set(['status', 'status_changed', 'resolved', 'closed']);

/**
 * When a ticket enters resolved/closed and the org has satisfaction surveys
 * enabled, record a survey for the requester and email them a rating link.
 * The survey row is created even when no email goes out (org email off,
 * requester closed their own ticket) so the portal prompt still works —
 * but each ticket is only ever surveyed once.
 */
export async function processCsatSurvey(job: NotificationEventJob, deps: CsatDeps): Promise<void> {
  const { eventType, changes, actorId } = job.event;
  if (!STATUS_EVENTS.has(eventType)) return;
  // Status events carry `changes: { from, to }` (see diffTicketActivity).
  const status = typeof changes?.to === 'string' ? changes.to : null;
  if (!status || !CSAT_TRIGGER_STATUSES.has(status)) return;

  const ticket = await deps.loadTicket(job.orgId, job.event.recordId);
  if (!ticket?.requesterId) return;

  const settings = await deps.loadCsatSettings(job.orgId);
  if (!settings.enabled) return;

  const created = await deps.createSurvey({ orgId: job.orgId, ticketId: ticket.id, requesterId: ticket.requesterId });
  if (!created) return; // already surveyed (e.g. resolved, then closed)

  // No email when the requester resolved their own ticket, when org outbound
  // is off, or when the requester has email notifications disabled.
  if (actorId === ticket.requesterId) return;
  if (!(await deps.orgEmailEnabled(job.orgId))) return;
  const prefs = await deps.loadPrefs(job.orgId, [ticket.requesterId]);
  const p = prefs[ticket.requesterId];
  if (!p || !p.emailEnabled) return;
  const to = await deps.loadEmail(ticket.requesterId);
  if (!to) return;

  const domain = await deps.fromDomain(job.orgId);
  const m = renderCsatEmail({ question: settings.question }, { ticket, fromDomain: domain, siteUrl: deps.siteUrl });
  await deps.enqueueEmail({ orgId: job.orgId, to, subject: m.subject, text: m.text, html: m.html, headers: { 'Message-ID': m.messageId } });
}
