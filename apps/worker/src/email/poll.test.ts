// SPDX-License-Identifier: AGPL-3.0-only

import { it, expect, vi } from 'vitest';
import { pollOrgInbound, type PollDeps } from './poll';

function deps(over: Partial<PollDeps> = {}): PollDeps {
  return {
    settings: { lastSeenUid: 0, mailbox: 'INBOX', acceptNewSenders: false, defaultSchemaId: 'sch-1', defaultTeamId: null, fromDomain: 'desk.acme.com' } satisfies PollDeps['settings'],
    knownUidValidity: null,
    source: { fetchSince: vi.fn(async () => ({ uidValidity: 1, messages: [
      { uid: 5, messageId: '<m5@ext>', from: 'user@acme.com', subject: 'Re: [#42] Help', text: 'thanks', inReplyTo: null, references: [], autoSubmitted: null, attachments: [] },
    ] })) },
    claimMessage: vi.fn(async () => true),
    linkTicket: vi.fn(async () => {}),
    findUserByEmail: vi.fn(async () => ({ id: 'req-1' })),
    ticketByNumber: vi.fn(async () => 'tkt-42'),
    ticketExists: vi.fn(async () => true),
    // Legitimate case: the sender (req-1) is the requester of the ticket they reply to.
    ticketRequesterId: vi.fn(async () => 'req-1'),
    addComment: vi.fn(async () => {}),
    createTicket: vi.fn(async () => 'tkt-new'),
    createRequester: vi.fn(async () => 'req-new'),
    storeAttachment: vi.fn(async () => {}),
    advanceCursor: vi.fn(async () => {}),
    publishCommented: vi.fn(async () => {}),
    publishCreated: vi.fn(async () => {}),
    ...over,
  };
}

it('threads a [#42] reply into a public comment and advances the cursor', async () => {
  const d = deps();
  await pollOrgInbound('o1', d);
  expect(d.addComment).toHaveBeenCalledWith(expect.objectContaining({ ticketId: 'tkt-42', internal: false }));
  expect(d.linkTicket).toHaveBeenCalledWith('o1', '<m5@ext>', 'tkt-42');
  expect(d.publishCommented).toHaveBeenCalledWith('o1', 'tkt-42', 'req-1');
  expect(d.advanceCursor).toHaveBeenCalledWith('o1', 5, 1);
});

it('does not inject a [#42] comment when the sender is not the ticket requester', async () => {
  // Stranger references someone else's ticket by number; must not become a comment.
  const d = deps({
    settings: { lastSeenUid: 0, mailbox: 'INBOX', acceptNewSenders: true, defaultSchemaId: 'sch-1', defaultTeamId: null, fromDomain: 'desk.acme.com' },
    ticketRequesterId: vi.fn(async () => 'someone-else'),
  });
  await pollOrgInbound('o1', d);
  expect(d.addComment).not.toHaveBeenCalled();
  expect(d.createTicket).toHaveBeenCalled(); // falls through to a new ticket
});

it('skips a message already claimed (idempotency)', async () => {
  const d = deps({ claimMessage: vi.fn(async () => false) });
  await pollOrgInbound('o1', d);
  expect(d.addComment).not.toHaveBeenCalled();
  expect(d.advanceCursor).toHaveBeenCalledWith('o1', 5, 1); // cursor still advances
});

it('poison message: addComment throws, loop does not throw, advanceCursor still called with max uid, subsequent good message is processed', async () => {
  let callCount = 0;
  const d = deps({
    source: {
      fetchSince: vi.fn(async () => ({
        uidValidity: 1,
        messages: [
          // uid 3 — poison: addComment will throw for this one
          { uid: 3, messageId: '<poison@ext>', from: 'user@acme.com', subject: 'Re: [#42] Help', text: 'bad', inReplyTo: null, references: [], autoSubmitted: null, attachments: [] },
          // uid 7 — good message that should still be processed
          { uid: 7, messageId: '<good@ext>', from: 'user@acme.com', subject: 'Re: [#42] Help', text: 'good', inReplyTo: null, references: [], autoSubmitted: null, attachments: [] },
        ],
      })),
    },
    addComment: vi.fn(async () => {
      callCount++;
      if (callCount === 1) throw new Error('poison!');
    }),
  });

  await expect(pollOrgInbound('o1', d)).resolves.toBeUndefined();
  // advanceCursor still called with max uid (7) from the batch
  expect(d.advanceCursor).toHaveBeenCalledWith('o1', 7, 1);
  // Good message (uid 7) was still processed — addComment called twice (second call succeeds)
  expect(d.addComment).toHaveBeenCalledTimes(2);
});

it('passes knownUidValidity to fetchSince', async () => {
  const fetchSince = vi.fn(async () => ({ uidValidity: 2, messages: [] }));
  const d = deps({ knownUidValidity: 1, source: { fetchSince } });
  await pollOrgInbound('o1', d);
  expect(fetchSince).toHaveBeenCalledWith(0, 1);
});
