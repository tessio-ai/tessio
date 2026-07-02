# AI & privacy

Tessio includes an optional AI assistant ("Tess") for ticket triage, summaries,
draft replies, similar-ticket search, and a natural-language "Ask Tess" search.
This page describes what leaves your instance when AI is enabled, and the
guardrails that protect personal data.

## AI is opt-in

AI is **disabled by default**. No data is sent anywhere until an administrator
enables it in **Settings → Tess AI** and supplies an **OpenAI API key**. Each feature
(summary, draft, triage, similar search, ask) is toggled individually. If you leave
AI off, Tessio makes no external model calls at all.

The provider is **OpenAI**. The API key you enter is **encrypted at rest** with your
`TESSIO_SECRET_KEY` and is never returned to the browser.

## What is sent to OpenAI

When a feature is enabled, the relevant ticket text is sent to OpenAI to produce that
result:

| Feature | Sent to OpenAI |
| --- | --- |
| Triage | Ticket title + description |
| Summary | Ticket title + description + comment text |
| Draft reply | Ticket title + description + comment text |
| Similar tickets | Ticket title + description (as an embedding) |
| Ask Tess | Your question + matching ticket titles |

## PII redaction guardrail

Before **any** of the above leaves your instance, Tessio scrubs common personal
identifiers and replaces them with placeholders (`[REDACTED_EMAIL]`,
`[REDACTED_SSN]`, `[REDACTED_PHONE]`, `[REDACTED_CARD]`):

- Email addresses
- US Social Security numbers
- Phone numbers
- Credit-card numbers (validated with the Luhn checksum)

The same redaction is applied to AI-derived data that Tessio stores — the triage
reasoning note and the vector embeddings — so raw PII is never persisted by the AI
pipeline either.

This guardrail is **always on and cannot be disabled**, and it is **boundary-only**:
it never alters the original ticket. An agent or HR user still sees the real values in
the ticket record; the redaction applies only to what is sent to or derived by the
model.

!!! note "Best-effort detection"
    Redaction is pattern-based and tuned to catch the common formats of each
    identifier while avoiding false positives on things like ticket numbers and
    dates. It is not a guarantee against every obfuscated variant (for example, a
    number spelled out in words). For the strongest assurance that no personal data
    reaches a third party, leave AI disabled.

## Turning AI off

To stop all external model calls, switch off **Enable Tess AI** in **Settings → Tess AI**
(or never enable it). No further data is sent once it is off. Embeddings created while AI
was on remain in your database — they are derived from already-redacted text — and are
removed together with their tickets when those tickets are deleted.
