// SPDX-License-Identifier: AGPL-3.0-only

import { ImapFlow } from 'imapflow';
import { simpleParser, type AddressObject } from 'mailparser';
import type { ParsedEmail } from './inbound';

/** Flatten mailparser's To/Cc shapes plus Delivered-To/X-Original-To headers into lowercased addresses. */
function collectRecipients(p: Awaited<ReturnType<typeof simpleParser>>): string[] {
  const out = new Set<string>();
  const addAddressObjects = (v: AddressObject | AddressObject[] | undefined) => {
    for (const obj of Array.isArray(v) ? v : v ? [v] : []) {
      for (const a of obj.value) if (a.address) out.add(a.address.toLowerCase());
    }
  };
  addAddressObjects(p.to);
  addAddressObjects(p.cc);
  for (const h of ['delivered-to', 'x-original-to']) {
    const raw = p.headers.get(h);
    for (const v of Array.isArray(raw) ? raw : raw ? [raw] : []) {
      const m = String(typeof v === 'object' && 'text' in (v as object) ? (v as { text: string }).text : v).match(/[^\s<>,;"]+@[^\s<>,;"]+/g);
      for (const addr of m ?? []) out.add(addr.toLowerCase());
    }
  }
  return [...out];
}

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
              recipients: collectRecipients(p),
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
