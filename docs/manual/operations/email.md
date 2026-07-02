# Email

Tessio can send outbound notification emails and receive inbound emails as new
tickets. Both channels are configured per-organisation in **Settings → Email**.
Credentials are stored encrypted (using `TESSIO_SECRET_KEY`) — never in plain
text.

Set `TESSIO_SITE_URL` to your instance's public URL (e.g.
`https://tessio.example.com`) so that links in notification emails point at the
right place.

## Outbound notifications

1. In **Settings → Email**, fill in the SMTP section: host, port, security
   (None / STARTTLS / TLS), username, and password.
2. Set a **From name** and **From address** (the envelope sender your users will
   see).
3. Toggle **Enable outbound email** on.
4. Click **Send test email** — Tessio sends a test message to your own account.
   Check your inbox and fix any SMTP errors before saving.

Notifications are sent to the ticket requester and assignee on activity (new
comment, status change, assignment, etc.). Each user controls which categories
they receive in **Settings → Notifications**. The in-app bell shows the same
feed regardless of email preferences.

## Inbound email-to-ticket

1. In **Settings → Email**, fill in the IMAP section: host, port, user,
   password, and the mailbox to watch (default: `INBOX`).
2. Choose the **Default ticket type** (and optionally a **Default team**) for
   tickets opened by email.
3. Toggle **Enable inbound email** on.
4. Click **Test connection** to verify Tessio can reach the mailbox.

Tessio polls the mailbox every `EMAIL_POLL_INTERVAL_MS` milliseconds (default
60 s). Each unseen message creates a new ticket, or threads back to an existing
one when the subject contains `[#<ticket-number>]` or the message includes the
hidden reply token embedded in notification emails.

Attachments are saved to the ticket automatically. Any single attachment
exceeding `EMAIL_ATTACHMENT_MAX_BYTES` (default 10 MB) is silently skipped.

## Accept mail from new senders

The **Accept mail from new senders** setting (default **off**) controls what
happens when an email arrives from an address not associated with any Tessio
user account:

- **Off** — the message is ignored. Use this for internal support inboxes where
  only existing users should open tickets.
- **On** — Tessio creates a no-login requester record for the unknown address
  and opens the ticket. Use this for a public-facing support inbox.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Test email not received | Verify SMTP host / port / credentials; check spam folder |
| IMAP test fails | Confirm the mailbox user has IMAP access and the port is open from the worker container |
| Notification links point at `localhost` | Set `TESSIO_SITE_URL` to your public URL |
| Replies create new tickets instead of threading | Ensure your mail client quotes the original message (the reply token must survive in the body) |
