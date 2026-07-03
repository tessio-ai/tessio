// SPDX-License-Identifier: AGPL-3.0-only

import { randomBytes, randomUUID } from 'node:crypto';
import {
  emailSettingsRepo,
  processedEmailsRepo,
  ticketsRepo,
  usersRepo,
  attachmentsRepo,
  schemasRepo,
  addComment,
  type Db,
} from '@tessio/db';
import { decryptSecret } from '@tessio/ai';
import { NOTIFICATIONS_QUEUE, type NotificationEventJob } from '@tessio/shared';
import { Queue } from 'bullmq';
import type IORedis from 'ioredis';
import type { Storage } from '../storage';
import { createImapSource } from './imap';
import type { PollDeps, PollSettings } from './poll';

/** Derive the sending domain from a from-address like "support@desk.acme.com". */
function extractDomain(fromAddress: string | null | undefined): string {
  if (!fromAddress) return 'localhost';
  const at = fromAddress.indexOf('@');
  return at >= 0 ? fromAddress.slice(at + 1) : 'localhost';
}

/** List org ids that have inbound IMAP enabled. */
export async function listInboundOrgs(db: Db): Promise<string[]> {
  return emailSettingsRepo(db).listInboundOrgs();
}

let _notificationsQueue: Queue<NotificationEventJob> | null = null;

function getNotificationsQueue(connection: IORedis): Queue<NotificationEventJob> {
  if (!_notificationsQueue) {
    _notificationsQueue = new Queue<NotificationEventJob>(NOTIFICATIONS_QUEUE, { connection });
  }
  return _notificationsQueue;
}

/**
 * Build the injected PollDeps for a single org, wiring real DB/storage/queue.
 * Returns null if the org isn't ready for polling (disabled / no IMAP config).
 */
export async function buildOrgPollDeps(
  db: Db,
  storage: Storage,
  connection: IORedis,
  orgId: string,
): Promise<PollDeps | null> {
  const row = await emailSettingsRepo(db).getOrCreate(orgId);
  if (!row || !row.inboundEnabled) return null;
  if (!row.imapHost || !row.imapUser || !row.imapPasswordCiphertext) return null;

  const secretKey = process.env.TESSIO_SECRET_KEY;
  if (!secretKey) throw new Error('TESSIO_SECRET_KEY is not set');

  const imapPass = decryptSecret(row.imapPasswordCiphertext, secretKey);
  const source = createImapSource({
    host: row.imapHost,
    port: row.imapPort ?? 993,
    secure: row.imapSecure ?? true,
    user: row.imapUser,
    pass: imapPass,
    mailbox: row.mailbox,
  });

  const fromDomain = extractDomain(row.fromAddress);

  const settings: PollSettings = {
    lastSeenUid: row.lastSeenUid,
    mailbox: row.mailbox,
    acceptNewSenders: row.acceptNewSenders,
    defaultSchemaId: row.defaultSchemaId ?? '',
    defaultTeamId: row.defaultTeamId ?? null,
    fromDomain,
  };

  const notifQueue = getNotificationsQueue(connection);

  const deps: PollDeps = {
    settings,
    knownUidValidity: row.uidValidity ?? null,
    source,

    claimMessage: (o, messageId, ticketId) =>
      processedEmailsRepo(db).claim(o, messageId, ticketId),

    linkTicket: (o, messageId, ticketId) =>
      processedEmailsRepo(db).linkTicket(o, messageId, ticketId),

    findUserByEmail: (email) => usersRepo(db).findByEmail(orgId, email),

    ticketByNumber: async (n) => {
      const t = await ticketsRepo(db).getByNumber(orgId, n);
      return t ? (t.id as string) : null;
    },

    ticketExists: async (id) => {
      const t = await ticketsRepo(db).getById(orgId, id);
      return !!t;
    },

    ticketRequesterId: async (id) => {
      const t = await ticketsRepo(db).getById(orgId, id);
      return t ? ((t.requesterId as string | null) ?? null) : null;
    },

    addComment: async ({ ticketId, body, internal, authorId }) => {
      await addComment(db, {
        orgId,
        recordType: 'ticket',
        recordId: ticketId,
        body,
        internal,
        ...(authorId ? { authorId } : {}),
      });
    },

    createTicket: async ({ orgId: o, schemaId, teamId, requesterId, title, description }) => {
      // Resolve schema version so we can pin it on the ticket row.
      const schema = await schemasRepo(db).getById(o, schemaId);
      const schemaVersion = schema?.version ?? 1;
      const t = await ticketsRepo(db).create({
        orgId: o,
        schemaId,
        schemaVersion,
        teamId: teamId ?? undefined,
        requesterId,
        data: { title, description },
      });
      return t.id as string;
    },

    createRequester: async (o, email) => {
      // Create a requester with no usable login (random unguessable password hash).
      const unusableHash = `scrypt$${randomBytes(16).toString('hex')}$${randomBytes(64).toString('hex')}`;
      const u = await usersRepo(db).create({
        orgId: o,
        email,
        name: email,
        role: 'requester',
        passwordHash: unusableHash,
      });
      return u.id as string;
    },

    storeAttachment: async ({ ticketId, filename, mime, size, content }) => {
      const attachmentId = randomUUID();
      const storageKey = `${orgId}/${attachmentId}`;
      await storage.put(storageKey, content);
      await attachmentsRepo(db).create({
        id: attachmentId,
        orgId,
        recordType: 'ticket',
        recordId: ticketId,
        filename,
        size,
        mime,
        storageKey,
      });
    },

    advanceCursor: async (o, maxUid, uidValidity) => {
      await emailSettingsRepo(db).update(o, {
        lastSeenUid: maxUid,
        ...(uidValidity !== null ? { uidValidity } : {}),
      });
    },

    publishCommented: async (o, ticketId, actorId) => {
      try {
        await notifQueue.add(
          'notification',
          { orgId: o, event: { eventType: 'commented', recordId: ticketId, actorId, internal: false } },
          { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
        );
      } catch (err) {
        console.error('failed to publish commented notification', err);
      }
    },

    publishCreated: async (o, ticketId, actorId) => {
      try {
        await notifQueue.add(
          'notification',
          { orgId: o, event: { eventType: 'created', recordId: ticketId, actorId } },
          { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
        );
      } catch (err) {
        console.error('failed to publish created notification', err);
      }
    },
  };

  return deps;
}
