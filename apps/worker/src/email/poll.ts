// SPDX-License-Identifier: AGPL-3.0-only

import { parseTicketIdFromHeaders } from '@tessio/shared';
import { decideInbound } from './inbound';
import type { ParsedEmail, ParsedEmailAttachment } from './inbound';
import type { ImapSource } from './imap';

const EMAIL_ATTACHMENT_MAX_BYTES = Number(process.env.EMAIL_ATTACHMENT_MAX_BYTES ?? 10485760);

// Minimal shape we need from email settings; the real row has more fields.
export interface PollSettings {
  lastSeenUid: number;
  mailbox: string;
  acceptNewSenders: boolean;
  defaultSchemaId: string;
  defaultTeamId: string | null;
  /** Derived from fromAddress — used to detect loops. */
  fromDomain: string;
}

export interface PollDeps {
  settings: PollSettings;
  /** Stored uidValidity from the last successful poll; null if not yet recorded. */
  knownUidValidity: number | null;
  source: Pick<ImapSource, 'fetchSince'>;

  /** Claim a message for processing; returns false if already claimed (idempotent). */
  claimMessage(orgId: string, messageId: string, ticketId: string | null): Promise<boolean>;

  /** Back-fill the claimed message with the ticket it resolved to (audit link email→ticket). */
  linkTicket(orgId: string, messageId: string, ticketId: string): Promise<void>;

  /** Look up a portal user by email address (returns null if not found). */
  findUserByEmail(email: string): Promise<{ id: string } | null | undefined>;

  /** Resolve a ticket number to a ticket id, or null if not found. */
  ticketByNumber(n: number): Promise<string | null>;

  /** Check whether a ticket id exists. */
  ticketExists(id: string): Promise<boolean>;

  /** Append a public comment to a ticket. */
  addComment(args: { ticketId: string; body: string; internal: boolean; authorId: string | null }): Promise<void>;

  /** Create a new ticket and return its id. */
  createTicket(args: {
    orgId: string;
    schemaId: string;
    teamId: string | null;
    requesterId: string;
    title: string;
    description: string;
  }): Promise<string>;

  /** Create a requester-role user with no login password, returning the new user id. */
  createRequester(orgId: string, email: string): Promise<string>;

  /** Persist one attachment to storage + metadata. */
  storeAttachment(args: {
    ticketId: string;
    filename: string;
    mime: string;
    size: number;
    content: Buffer;
  }): Promise<void>;

  /** Advance the IMAP cursor after a successful poll batch. */
  advanceCursor(orgId: string, maxUid: number, uidValidity: number | null): Promise<void>;

  /** Publish a "commented" notification event. */
  publishCommented(orgId: string, ticketId: string, actorId: string | null): Promise<void>;

  /** Publish a "created" notification event. */
  publishCreated(orgId: string, ticketId: string, actorId: string | null): Promise<void>;
}

async function storeAttachments(
  ticketId: string,
  attachments: ParsedEmailAttachment[],
  storeAttachment: PollDeps['storeAttachment'],
): Promise<void> {
  for (const att of attachments) {
    if (att.size > EMAIL_ATTACHMENT_MAX_BYTES) continue;
    await storeAttachment({ ticketId, filename: att.filename, mime: att.contentType, size: att.size, content: att.content });
  }
}

export async function pollOrgInbound(orgId: string, deps: PollDeps): Promise<void> {
  const { messages, uidValidity } = await deps.source.fetchSince(deps.settings.lastSeenUid, deps.knownUidValidity);

  let maxUid = deps.settings.lastSeenUid;

  for (const msg of messages) {
    // Always advance maxUid, even for poison messages, so the cursor moves past them.
    maxUid = Math.max(maxUid, msg.uid);

    // Idempotency: claim the message; if already processed, skip processing but still advance cursor.
    const claimed = await deps.claimMessage(orgId, msg.messageId, null);
    if (!claimed) continue;

    try {
      // Pre-resolve async lookups so we can pass sync closures to decideInbound.
      const senderUser = await deps.findUserByEmail(msg.from);
      const senderIsKnown = !!senderUser;

      // Resolve ticket from In-Reply-To / References headers.
      const headerIds = [msg.inReplyTo ?? '', ...msg.references].filter(Boolean);
      const headerTicketId = parseTicketIdFromHeaders(headerIds);
      const headerTicketExists = headerTicketId ? await deps.ticketExists(headerTicketId) : false;

      // Resolve ticket from subject [#N] token.
      const NUMBER_TOKEN = /\[#(\d+)\]/;
      const tok = msg.subject.match(NUMBER_TOKEN);
      const subjectTicketId = tok ? await deps.ticketByNumber(Number(tok[1])) : null;
      const subjectTicketExists = subjectTicketId ? await deps.ticketExists(subjectTicketId) : false;

      const decision = decideInbound(msg as ParsedEmail, {
        fromDomain: deps.settings.fromDomain,
        acceptNewSenders: deps.settings.acceptNewSenders,
        senderIsKnown,
        ticketExists: (id) => {
          if (id === headerTicketId) return headerTicketExists;
          if (id === subjectTicketId) return subjectTicketExists;
          return false;
        },
        ticketByNumber: () => subjectTicketId,
      });

      if (decision.kind === 'comment') {
        const authorId = senderUser?.id ?? null;
        await deps.addComment({ ticketId: decision.ticketId, body: msg.text, internal: false, authorId });
        await storeAttachments(decision.ticketId, msg.attachments, deps.storeAttachment);
        await deps.linkTicket(orgId, msg.messageId, decision.ticketId);
        await deps.publishCommented(orgId, decision.ticketId, authorId);
      } else if (decision.kind === 'new-ticket') {
        const requesterId = senderUser?.id ?? await deps.createRequester(orgId, msg.from);
        const ticketId = await deps.createTicket({
          orgId,
          schemaId: deps.settings.defaultSchemaId,
          teamId: deps.settings.defaultTeamId,
          requesterId,
          title: msg.subject,
          description: msg.text,
        });
        await storeAttachments(ticketId, msg.attachments, deps.storeAttachment);
        await deps.linkTicket(orgId, msg.messageId, ticketId);
        await deps.publishCreated(orgId, ticketId, requesterId);
      }
      // ignore: do nothing
    } catch (err) {
      console.error(`email poll: error processing message orgId=${orgId} messageId=${msg.messageId}`, err);
      // Message is already claimed so it won't reprocess; advance past it by continuing.
    }
  }

  await deps.advanceCursor(orgId, maxUid, uidValidity);
}
