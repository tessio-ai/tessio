// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { randomBytes, randomUUID } from 'node:crypto';
import {
  createTestDb,
  resetDb,
  seedOrgAndSchema,
} from '@tessio/db/testing';
import {
  ticketsRepo,
  usersRepo,
  emailSettingsRepo,
  processedEmailsRepo,
  attachmentsRepo,
  schemasRepo,
  addComment,
  listComments,
} from '@tessio/db';
import { diskStorage } from '../storage';
import { pollOrgInbound, type PollDeps } from './poll';
import type { FetchResult } from './imap';

// ---------------------------------------------------------------------------
// Shared DB + storage
// ---------------------------------------------------------------------------
const db = createTestDb();

beforeEach(async () => {
  await resetDb(db);
});

afterAll(async () => {
  await db.$client.end();
});

// ---------------------------------------------------------------------------
// Helpers to build real PollDeps with a fake source (no IMAP, no Redis)
// ---------------------------------------------------------------------------
function buildTestDeps(
  orgId: string,
  fakeSource: { fetchSince(uid: number, knownValidity?: number | null): Promise<FetchResult> },
  storage: ReturnType<typeof diskStorage>,
  settings: {
    lastSeenUid: number;
    mailbox: string;
    acceptNewSenders: boolean;
    defaultSchemaId: string;
    defaultTeamId: string | null;
    fromDomain: string;
    teamAddresses: Record<string, string>;
  },
): PollDeps {
  const repos = {
    tickets: ticketsRepo(db),
    users: usersRepo(db),
    emailSettings: emailSettingsRepo(db),
    processedEmails: processedEmailsRepo(db),
    attachments: attachmentsRepo(db),
    schemas: schemasRepo(db),
  };

  return {
    settings,
    knownUidValidity: null,
    source: fakeSource,

    claimMessage: (o, messageId, ticketId) =>
      repos.processedEmails.claim(o, messageId, ticketId),

    linkTicket: (o, messageId, ticketId) =>
      repos.processedEmails.linkTicket(o, messageId, ticketId),

    findUserByEmail: (email) => repos.users.findByEmail(orgId, email),

    ticketByNumber: async (n) => {
      const t = await repos.tickets.getByNumber(orgId, n);
      return t ? (t.id as string) : null;
    },

    ticketExists: async (id) => {
      const t = await repos.tickets.getById(orgId, id);
      return !!t;
    },

    ticketRequesterId: async (id) => {
      const t = await repos.tickets.getById(orgId, id);
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
      const schema = await repos.schemas.getById(o, schemaId);
      const schemaVersion = schema?.version ?? 1;
      const t = await repos.tickets.create({
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
      const unusableHash = `scrypt$${randomBytes(16).toString('hex')}$${randomBytes(64).toString('hex')}`;
      const u = await repos.users.create({
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
      await repos.attachments.create({
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
      await repos.emailSettings.update(o, {
        lastSeenUid: maxUid,
        ...(uidValidity !== null ? { uidValidity } : {}),
      });
    },

    // No Redis in integration tests — swallow publish silently.
    publishCommented: async () => {},
    publishCreated: async () => {},
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------
describe('pollOrgInbound — end-to-end', () => {
  it('adds a thread-reply comment + attachment; ignores auto-reply; advances cursor', async () => {
    // -----------------------------------------------------------------------
    // 1. Seed: org + schema + requester user + ticket #42
    // -----------------------------------------------------------------------
    const { orgId, schemaId, schemaVersion } = await seedOrgAndSchema(db, 'ticket');

    const requester = await usersRepo(db).create({
      orgId,
      email: 'user@acme.com',
      name: 'User Acme',
      role: 'requester',
      passwordHash: 'unusable',
    });

    // Create tickets until we reach number 42.
    // assignNextNumber starts at 1, so we create 42 tickets — the last will be #42.
    let ticket42Id = '';
    for (let i = 0; i < 42; i++) {
      const t = await ticketsRepo(db).create({
        orgId,
        schemaId,
        schemaVersion,
        requesterId: requester.id,
        data: { title: `Ticket ${i + 1}` },
      });
      if (i === 41) {
        ticket42Id = t.id as string;
      }
    }

    // Verify ticket #42 exists.
    const t42 = await ticketsRepo(db).getByNumber(orgId, 42);
    expect(t42).toBeDefined();
    expect(t42!.id).toBe(ticket42Id);

    // -----------------------------------------------------------------------
    // 2. Configure email_settings
    // -----------------------------------------------------------------------
    await emailSettingsRepo(db).getOrCreate(orgId);
    await emailSettingsRepo(db).update(orgId, {
      inboundEnabled: true,
      fromAddress: 'support@desk.acme.com',
      defaultSchemaId: schemaId,
      acceptNewSenders: false,
      lastSeenUid: 0,
    });

    // -----------------------------------------------------------------------
    // 3. Build real PollDeps with a fake IMAP source
    // -----------------------------------------------------------------------
    const storageDir = mkdtempSync(`${tmpdir()}/tessio-test-`);
    const storage = diskStorage(storageDir);

    const fakeSource = {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      async fetchSince(_uid: number): Promise<FetchResult> {
        return {
          uidValidity: 1,
          messages: [
            {
              uid: 10,
              messageId: '<a@ext>',
              from: 'user@acme.com',
              recipients: ['support@desk.acme.com'],
              subject: 'Re: [#42] Help',
              text: 'thanks for the help',
              inReplyTo: null,
              references: [],
              autoSubmitted: null,
              attachments: [
                {
                  filename: 'log.txt',
                  contentType: 'text/plain',
                  content: Buffer.from('hello log'),
                  size: 9,
                },
              ],
            },
            {
              uid: 11,
              messageId: '<b@ext>',
              from: 'someone@acme.com',
              recipients: ['support@desk.acme.com'],
              subject: 'Out of office',
              text: 'I am away',
              inReplyTo: null,
              references: [],
              autoSubmitted: 'auto-replied',
              attachments: [],
            },
          ],
        };
      },
    };

    const settings = {
      lastSeenUid: 0,
      mailbox: 'INBOX',
      acceptNewSenders: false,
      defaultSchemaId: schemaId,
      defaultTeamId: null,
      fromDomain: 'desk.acme.com',
      teamAddresses: {},
    };

    const deps = buildTestDeps(orgId, fakeSource, storage, settings);

    // -----------------------------------------------------------------------
    // 4. Run the poll
    // -----------------------------------------------------------------------
    await pollOrgInbound(orgId, deps);

    // -----------------------------------------------------------------------
    // 5a. Ticket #42 has exactly one new public comment containing the reply text
    // -----------------------------------------------------------------------
    const ticketComments = await listComments(db, orgId, 'ticket', ticket42Id);
    const publicComments = ticketComments.filter((c) => !c.internal);
    expect(publicComments).toHaveLength(1);
    expect(publicComments[0].body).toContain('thanks for the help');

    // -----------------------------------------------------------------------
    // 5b. One attachment row for ticket #42 with filename log.txt; bytes match
    // -----------------------------------------------------------------------
    const attachmentsList = await attachmentsRepo(db).list(orgId, 'ticket', ticket42Id);
    expect(attachmentsList).toHaveLength(1);
    expect(attachmentsList[0].filename).toBe('log.txt');
    const storedBytes = await storage.get(attachmentsList[0].storageKey);
    expect(storedBytes).toEqual(Buffer.from('hello log'));

    // -----------------------------------------------------------------------
    // 5c. Auto-reply (msg B) created NO ticket and NO comment
    // -----------------------------------------------------------------------
    // Total tickets in org: still exactly 42 (no new ticket from 'Out of office')
    const allTickets = await ticketsRepo(db).list(orgId);
    expect(allTickets).toHaveLength(42);
    const oooTicket = await ticketsRepo(db).getByNumber(orgId, 43);
    expect(oooTicket).toBeUndefined();

    // -----------------------------------------------------------------------
    // 5d. Both message IDs recorded in processed_emails
    // -----------------------------------------------------------------------
    expect(await processedEmailsRepo(db).wasProcessed(orgId, '<a@ext>')).toBe(true);
    expect(await processedEmailsRepo(db).wasProcessed(orgId, '<b@ext>')).toBe(true);

    // -----------------------------------------------------------------------
    // 5e. lastSeenUid advanced to 11
    // -----------------------------------------------------------------------
    const updatedSettings = await emailSettingsRepo(db).getOrCreate(orgId);
    expect(updatedSettings!.lastSeenUid).toBe(11);
  });
});
