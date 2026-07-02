// SPDX-License-Identifier: AGPL-3.0-only

import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import type { ParsedEmail } from './inbound';

export interface ImapConfig { host: string; port: number; secure: boolean; user: string; pass: string; mailbox: string; }
export interface FetchResult { messages: (ParsedEmail & { uid: number })[]; uidValidity: number | null; }
export interface ImapSource { fetchSince(uid: number, knownValidity?: number | null): Promise<FetchResult>; }

export function createImapSource(cfg: ImapConfig): ImapSource {
  return {
    async fetchSince(lastUid, knownValidity?) {
      const client = new ImapFlow({ host: cfg.host, port: cfg.port, secure: cfg.secure, auth: { user: cfg.user, pass: cfg.pass }, logger: false });
      const out: (ParsedEmail & { uid: number })[] = [];
      let uidValidity: number | null = null;
      await client.connect();
      try {
        const lock = await client.getMailboxLock(cfg.mailbox);
        try {
          const mbox = client.mailbox;
          uidValidity = mbox !== false ? Number(mbox.uidValidity) : null;
          // If the stored uidValidity differs from the live one, the mailbox was renumbered
          // (UIDs are no longer comparable). Reset the fetch floor to 0 so no mail is missed.
          const effectiveLastUid = (knownValidity != null && uidValidity != null && uidValidity !== knownValidity) ? 0 : lastUid;
          for await (const msg of client.fetch({ uid: `${effectiveLastUid + 1}:*` }, { uid: true, source: true })) {
            if (msg.uid <= effectiveLastUid) continue;
            const p = await simpleParser(msg.source as Buffer);
            out.push({
              uid: msg.uid,
              messageId: p.messageId ?? `<uid-${msg.uid}@${cfg.host}>`,
              from: p.from?.value?.[0]?.address ?? '',
              subject: p.subject ?? '',
              text: p.text ?? '',
              inReplyTo: p.inReplyTo ?? null,
              references: Array.isArray(p.references) ? p.references : p.references ? [p.references] : [],
              autoSubmitted: (p.headers.get('auto-submitted') as string) ?? null,
              attachments: (p.attachments ?? []).map((a) => ({ filename: a.filename ?? 'attachment', contentType: a.contentType, content: a.content as Buffer, size: a.size })),
            });
          }
        } finally { lock.release(); }
      } finally { await client.logout(); }
      return { messages: out, uidValidity };
    },
  };
}
