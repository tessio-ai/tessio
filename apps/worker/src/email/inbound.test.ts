// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { decideInbound, type ParsedEmail } from './inbound';

const base: ParsedEmail = {
  messageId: '<m1@ext>', from: 'user@acme.com', subject: 'Help', text: 'hi',
  inReplyTo: null, references: [], autoSubmitted: null, attachments: [],
};
const lookup = { knownTicketId: 'tkt-1', fromDomain: 'desk.acme.com' };

describe('decideInbound', () => {
  it('threads a reply that references a ticket Message-ID', () => {
    const r = decideInbound({ ...base, references: ['<tkt-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa-x@desk.acme.com>'] }, { ...lookup, ticketExists: () => true });
    expect(r).toEqual({ kind: 'comment', ticketId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' });
  });
  it('threads via the [#number] subject token when headers are missing', () => {
    const r = decideInbound({ ...base, subject: 'Re: [#42] Help' }, { ...lookup, ticketByNumber: () => 'tkt-42', ticketExists: () => true });
    expect(r).toEqual({ kind: 'comment', ticketId: 'tkt-42' });
  });
  it('ignores auto-replies', () => {
    expect(decideInbound({ ...base, autoSubmitted: 'auto-replied' }, lookup).kind).toBe('ignore');
  });
  it('ignores mail from our own outbound domain (loop guard)', () => {
    expect(decideInbound({ ...base, from: 'tess@desk.acme.com' }, lookup).kind).toBe('ignore');
  });
  it('new ticket for a known sender with no thread match', () => {
    expect(decideInbound(base, { ...lookup, senderIsKnown: true }).kind).toBe('new-ticket');
  });
  it('ignores an unknown sender when acceptNewSenders is off', () => {
    expect(decideInbound(base, { ...lookup, senderIsKnown: false, acceptNewSenders: false }).kind).toBe('ignore');
  });
  it('creates a ticket for an unknown sender when acceptNewSenders is on', () => {
    expect(decideInbound(base, { ...lookup, senderIsKnown: false, acceptNewSenders: true }).kind).toBe('new-ticket');
  });
  it('ignores a message with an empty from address', () => {
    expect(decideInbound({ ...base, from: '' }, lookup)).toEqual({ kind: 'ignore', reason: 'no-sender' });
  });
});
