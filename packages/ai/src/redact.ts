// SPDX-License-Identifier: AGPL-3.0-only

/**
 * PII redaction guardrail. Scrubs the most sensitive personal identifiers —
 * email addresses, US Social Security numbers, credit-card numbers, and phone
 * numbers — from any text before it is sent to OpenAI (prompts + embeddings) or
 * persisted in an AI-derived field (e.g. triage reasoning).
 *
 * This is a **boundary** guardrail: the original ticket the user typed is never
 * modified, so HR still sees the real values in the record. It only prevents PII
 * from reaching the LLM or being copied into AI output. It is deliberately
 * always-on and conservative (it prefers over-redaction to leaking).
 */

// Email — redacted first so the digits inside an address aren't mistaken for a phone.
const EMAIL = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
// US SSN: 3-2-4 grouped by space/dash/dot (e.g. 123-45-6789). Distinct from dates (4-2-2).
const SSN = /\b\d{3}[-.\s]\d{2}[-.\s]\d{4}\b/g;
// Credit-card candidate: 13–19 digits, optionally single-separated, ending on a digit
// (so a trailing space/word isn't consumed). Luhn-validated below.
const CARD = /\b\d(?:[ -]?\d){12,18}\b/g;
// International phone with a leading + and 7+ digits/separators.
const PHONE_INTL = /\+\d[\d\s().-]{7,}\d/g;
// Formatted NANP phone: (555) 123-4567 / 555-123-4567 / 555.123.4567 (requires a separator).
const PHONE_FORMATTED = /(?:\(\d{3}\)|\d{3})[\s.-]\d{3}[\s.-]\d{4}\b/g;
// Bare 10–11 digit run (5551234567). Phone is explicitly in scope, so this is intentional.
const PHONE_BARE = /\b\d{10,11}\b/g;

/** Luhn checksum — true for plausible card numbers, filtering most random digit runs. */
function luhnValid(digits: string): boolean {
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let dbl = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

/** Replace any PII in `text` with `[REDACTED_*]` placeholders. Safe on empty input. */
export function redactPii(text: string): string {
  if (!text) return text;
  let out = text.replace(EMAIL, '[REDACTED_EMAIL]');
  out = out.replace(SSN, '[REDACTED_SSN]');
  out = out.replace(CARD, (m) => (luhnValid(m.replace(/\D/g, '')) ? '[REDACTED_CARD]' : m));
  out = out.replace(PHONE_INTL, '[REDACTED_PHONE]');
  out = out.replace(PHONE_FORMATTED, '[REDACTED_PHONE]');
  out = out.replace(PHONE_BARE, '[REDACTED_PHONE]');
  return out;
}

/** Redact the free-text fields of a ticket context (title + description). */
export function redactTicketFields<T extends { title: string; description: string }>(ticket: T): T {
  return { ...ticket, title: redactPii(ticket.title), description: redactPii(ticket.description) };
}

/** Redact the body of each comment (author names are left as-is). */
export function redactCommentBodies<T extends { body: string }>(comments: T[]): T[] {
  return comments.map((c) => ({ ...c, body: redactPii(c.body) }));
}
