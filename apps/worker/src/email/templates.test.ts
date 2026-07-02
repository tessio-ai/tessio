// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { renderNotificationEmail } from './templates';

const ctx = { ticket: { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', number: 42, title: 'VPN down' }, fromDomain: 'desk.acme.com', siteUrl: 'https://desk.acme.com' };

describe('renderNotificationEmail', () => {
  it('puts the ticket token in the subject and a threading Message-ID in headers', () => {
    const m = renderNotificationEmail({ type: 'reply', snippet: 'We are looking into it' }, ctx);
    expect(m.subject).toBe('[#42] VPN down');
    expect(m.messageId).toMatch(/^<tkt-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa-[a-z0-9]+@desk\.acme\.com>$/);
    expect(m.text).toContain('We are looking into it');
    expect(m.html).toContain('We are looking into it');
    expect(m.text).toContain('https://desk.acme.com');
  });
});
