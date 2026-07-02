// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { encodeTicketMessageId, parseTicketIdFromHeaders, notificationPrefsSchema, DEFAULT_NOTIFICATION_PREFS } from './email';

describe('ticket Message-ID', () => {
  it('round-trips a ticket id through a Message-ID', () => {
    const mid = encodeTicketMessageId('11111111-1111-1111-1111-111111111111', 'desk.acme.com');
    expect(mid).toMatch(/^<tkt-11111111-1111-1111-1111-111111111111-[a-z0-9]+@desk\.acme\.com>$/);
    expect(parseTicketIdFromHeaders([mid])).toBe('11111111-1111-1111-1111-111111111111');
  });
  it('finds the id among multiple References', () => {
    expect(parseTicketIdFromHeaders(['<x@a>', '<tkt-22222222-2222-2222-2222-222222222222-ab@a.com>'])).toBe('22222222-2222-2222-2222-222222222222');
  });
  it('returns null when no ticket header is present', () => {
    expect(parseTicketIdFromHeaders(['<random@host>'])).toBeNull();
  });
});

describe('notification prefs', () => {
  it('fills defaults for a partial object', () => {
    expect(notificationPrefsSchema.parse({})).toEqual(DEFAULT_NOTIFICATION_PREFS);
  });
});
