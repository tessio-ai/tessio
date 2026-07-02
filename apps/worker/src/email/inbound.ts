// SPDX-License-Identifier: AGPL-3.0-only

import { parseTicketIdFromHeaders } from '@tessio/shared';

export interface ParsedEmailAttachment { filename: string; contentType: string; content: Buffer; size: number; }
export interface ParsedEmail {
  messageId: string; from: string; subject: string; text: string;
  inReplyTo: string | null; references: string[]; autoSubmitted: string | null; attachments: ParsedEmailAttachment[];
}
export interface InboundLookup {
  fromDomain: string;
  ticketExists?: (id: string) => boolean;
  ticketByNumber?: (n: number) => string | null;
  senderIsKnown?: boolean;
  acceptNewSenders?: boolean;
}
export type InboundDecision =
  | { kind: 'comment'; ticketId: string }
  | { kind: 'new-ticket' }
  | { kind: 'ignore'; reason: string };

const NUMBER_TOKEN = /\[#(\d+)\]/;

export function decideInbound(email: ParsedEmail, lookup: InboundLookup): InboundDecision {
  if (!email.from || !email.from.trim()) return { kind: 'ignore', reason: 'no-sender' };
  if (email.autoSubmitted && email.autoSubmitted !== 'no') return { kind: 'ignore', reason: 'auto-submitted' };
  const sender = email.from.toLowerCase();
  if (/(^|<)(no-?reply|mailer-daemon|postmaster)@/.test(sender)) return { kind: 'ignore', reason: 'system-sender' };
  if (sender.endsWith(`@${lookup.fromDomain.toLowerCase()}`)) return { kind: 'ignore', reason: 'loop' };

  const headerIds = [email.inReplyTo ?? '', ...email.references].filter(Boolean);
  const fromHeader = parseTicketIdFromHeaders(headerIds);
  if (fromHeader && lookup.ticketExists?.(fromHeader)) return { kind: 'comment', ticketId: fromHeader };

  const tok = email.subject.match(NUMBER_TOKEN);
  if (tok && lookup.ticketByNumber) {
    const id = lookup.ticketByNumber(Number(tok[1]));
    if (id && lookup.ticketExists?.(id)) return { kind: 'comment', ticketId: id };
  }

  if (lookup.senderIsKnown) return { kind: 'new-ticket' };
  if (lookup.acceptNewSenders) return { kind: 'new-ticket' };
  return { kind: 'ignore', reason: 'unknown-sender' };
}
