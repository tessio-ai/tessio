// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { redactPii, redactTicketFields, redactCommentBodies } from './redact';

describe('redactPii', () => {
  it('redacts US SSNs (dash, space, dot separators)', () => {
    expect(redactPii('SSN 123-45-6789 on file')).toBe('SSN [REDACTED_SSN] on file');
    expect(redactPii('123 45 6789')).toBe('[REDACTED_SSN]');
    expect(redactPii('123.45.6789')).toBe('[REDACTED_SSN]');
  });

  it('redacts email addresses', () => {
    expect(redactPii('reach me at jane.doe+hr@acme.co.uk please')).toBe('reach me at [REDACTED_EMAIL] please');
  });

  it('redacts phone numbers in common formats', () => {
    for (const p of ['(555) 123-4567', '555-123-4567', '555.123.4567', '5551234567', '+1 555 123 4567', '+44 20 7946 0958']) {
      expect(redactPii(`call ${p}`), p).toBe('call [REDACTED_PHONE]');
    }
  });

  it('redacts Luhn-valid credit-card numbers, grouped or not', () => {
    expect(redactPii('card 4242 4242 4242 4242 exp')).toBe('card [REDACTED_CARD] exp');
    expect(redactPii('4111111111111111')).toBe('[REDACTED_CARD]');
  });

  it('does not redact a Luhn-invalid 16-digit run as a card', () => {
    // 4242…4241 fails Luhn → not treated as a card, and a 16-digit token is left intact.
    expect(redactPii('4242424242424241')).toBe('4242424242424241');
  });

  it('leaves ordinary content untouched', () => {
    for (const s of ['ticket #1042 is open', 'meeting on 2026-06-10 at 9am', 'error code 500', 'v1.2.3 build 88']) {
      expect(redactPii(s), s).toBe(s);
    }
  });

  it('handles multiple PII types in one string', () => {
    const out = redactPii('John (ssn 123-45-6789, john@x.com, 555-123-4567) reported an issue');
    expect(out).toBe('John (ssn [REDACTED_SSN], [REDACTED_EMAIL], [REDACTED_PHONE]) reported an issue');
  });

  it('is safe on empty input', () => {
    expect(redactPii('')).toBe('');
  });
});

describe('redactTicketFields', () => {
  it('redacts title + description but preserves other fields', () => {
    const t = { number: 7, title: 'Reset for 555-123-4567', description: 'SSN 123-45-6789', category: 'Account' };
    expect(redactTicketFields(t)).toEqual({
      number: 7,
      title: 'Reset for [REDACTED_PHONE]',
      description: 'SSN [REDACTED_SSN]',
      category: 'Account',
    });
  });
});

describe('redactCommentBodies', () => {
  it('redacts each body but keeps author/internal', () => {
    const cs = [{ author: 'Ada', internal: true, body: 'email ada@acme.com' }];
    expect(redactCommentBodies(cs)).toEqual([{ author: 'Ada', internal: true, body: 'email [REDACTED_EMAIL]' }]);
  });
});
