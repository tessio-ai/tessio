// SPDX-License-Identifier: AGPL-3.0-only

import { encodeTicketMessageId, DEFAULT_CSAT_QUESTION, CSAT_MIN_RATING, CSAT_MAX_RATING, type NotificationType } from '@tessio/shared';

export interface TemplateCtx {
  ticket: { id: string; number: number; title: string };
  fromDomain: string;
  siteUrl: string;
}
export interface RenderedEmail { subject: string; text: string; html: string; messageId: string; }

const LEAD: Record<NotificationType, string> = {
  reply: 'There is a new reply on your ticket.',
  assigned: 'A ticket was assigned to you.',
  status: 'Your ticket status changed.',
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}

export function renderNotificationEmail(n: { type: NotificationType; snippet: string }, ctx: TemplateCtx): RenderedEmail {
  const url = `${ctx.siteUrl}/#/tickets/${ctx.ticket.id}`;
  const subject = `[#${ctx.ticket.number}] ${ctx.ticket.title}`;
  const text = [LEAD[n.type], '', n.snippet, '', `View ticket: ${url}`].join('\n');
  const html = `<p>${escapeHtml(LEAD[n.type])}</p><blockquote>${escapeHtml(n.snippet)}</blockquote><p><a href="${url}">View ticket #${ctx.ticket.number}</a></p>`;
  return { subject, text, html, messageId: encodeTicketMessageId(ctx.ticket.id, ctx.fromDomain) };
}

/** Satisfaction survey sent to the requester when their ticket is resolved/closed. */
export function renderCsatEmail(s: { question: string | null }, ctx: TemplateCtx): RenderedEmail {
  const question = s.question?.trim() || DEFAULT_CSAT_QUESTION;
  const rateUrl = (rating?: number) =>
    `${ctx.siteUrl}/#/tickets/${ctx.ticket.id}/rate${rating ? `/${rating}` : ''}`;
  const subject = `How did we do? [#${ctx.ticket.number}] ${ctx.ticket.title}`;
  const scores: number[] = [];
  for (let r = CSAT_MIN_RATING; r <= CSAT_MAX_RATING; r++) scores.push(r);
  const text = [
    question,
    '',
    `Rate your experience with request #${ctx.ticket.number} from ${CSAT_MIN_RATING} (very dissatisfied) to ${CSAT_MAX_RATING} (very satisfied):`,
    '',
    ...scores.map((r) => `  ${r} — ${rateUrl(r)}`),
    '',
    `Or leave a comment too: ${rateUrl()}`,
  ].join('\n');
  const buttons = scores
    .map((r) => `<a href="${rateUrl(r)}" style="display:inline-block;margin:0 4px;padding:10px 16px;border:1px solid #d0d3da;border-radius:8px;text-decoration:none;font-weight:600">${r}</a>`)
    .join('');
  const html = [
    `<p>${escapeHtml(question)}</p>`,
    `<p>Rate your experience with request #${ctx.ticket.number} from ${CSAT_MIN_RATING} (very dissatisfied) to ${CSAT_MAX_RATING} (very satisfied):</p>`,
    `<p>${buttons}</p>`,
    `<p><a href="${rateUrl()}">Leave a comment too</a></p>`,
  ].join('');
  return { subject, text, html, messageId: encodeTicketMessageId(ctx.ticket.id, ctx.fromDomain) };
}
