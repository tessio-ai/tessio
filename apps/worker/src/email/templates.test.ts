// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { DEFAULT_CSAT_QUESTION } from '@tessio/shared';
import { renderNotificationEmail, renderCsatEmail } from './templates';

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

describe('renderCsatEmail', () => {
  it('links each score to the portal rate page and falls back to the default question', () => {
    const m = renderCsatEmail({ question: null }, ctx);
    expect(m.subject).toContain('#42');
    expect(m.text).toContain(DEFAULT_CSAT_QUESTION);
    for (let r = 1; r <= 5; r++) {
      expect(m.html).toContain(`https://desk.acme.com/#/tickets/${ctx.ticket.id}/rate/${r}`);
    }
    expect(m.text).toContain(`https://desk.acme.com/#/tickets/${ctx.ticket.id}/rate`);
    expect(m.messageId).toMatch(/^<tkt-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa-[a-z0-9]+@desk\.acme\.com>$/);
  });

  it('uses the custom question and escapes HTML in it', () => {
    const m = renderCsatEmail({ question: 'Happy with <IT>?' }, ctx);
    expect(m.text).toContain('Happy with <IT>?');
    expect(m.html).toContain('Happy with &lt;IT&gt;?');
    expect(m.html).not.toContain('<IT>');
  });
});
