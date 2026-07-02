// SPDX-License-Identifier: AGPL-3.0-only

import { encodeTicketMessageId, type NotificationType } from '@tessio/shared';

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
