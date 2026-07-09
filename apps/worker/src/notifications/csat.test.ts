// SPDX-License-Identifier: AGPL-3.0-only

import { it, expect, vi } from 'vitest';
import { processCsatSurvey, type CsatDeps } from './csat';

function deps(over: Partial<CsatDeps> = {}): CsatDeps {
  return {
    loadTicket: vi.fn(async () => ({ id: 't1', number: 7, title: 'Printer', requesterId: 'req-1', assigneeId: 'agent-2', teamId: null })),
    loadCsatSettings: vi.fn(async () => ({ enabled: true, question: null })),
    createSurvey: vi.fn(async () => true),
    loadPrefs: vi.fn(async () => ({ 'req-1': { emailEnabled: true, assigned: true, replies: true, statusChanges: true } })),
    loadEmail: vi.fn(async (id: string) => (id === 'req-1' ? 'req@x.com' : null)),
    enqueueEmail: vi.fn(async () => {}),
    orgEmailEnabled: vi.fn(async () => true),
    fromDomain: vi.fn(async () => 'desk.acme.com'),
    siteUrl: 'https://desk.acme.com',
    ...over,
  };
}

// Status events carry { from, to } changes — the shape diffTicketActivity publishes.
const resolvedEvent = (actorId = 'agent-2', status = 'resolved') => ({
  orgId: 'o1',
  event: { eventType: 'status', recordId: 't1', actorId, changes: { from: 'open', to: status } },
});

it('creates a survey and emails the requester when a ticket is resolved', async () => {
  const d = deps();
  await processCsatSurvey(resolvedEvent(), d);
  expect(d.createSurvey).toHaveBeenCalledWith({ orgId: 'o1', ticketId: 't1', requesterId: 'req-1' });
  expect(d.enqueueEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'req@x.com', orgId: 'o1', subject: expect.stringContaining('#7') }));
});

it('also fires when the ticket is closed directly', async () => {
  const d = deps();
  await processCsatSurvey(resolvedEvent('agent-2', 'closed'), d);
  expect(d.enqueueEmail).toHaveBeenCalled();
});

it('does nothing for non-status events or non-terminal statuses', async () => {
  const d = deps();
  await processCsatSurvey({ orgId: 'o1', event: { eventType: 'commented', recordId: 't1', actorId: 'agent-2' } }, d);
  await processCsatSurvey(resolvedEvent('agent-2', 'in_progress'), d);
  expect(d.createSurvey).not.toHaveBeenCalled();
  expect(d.enqueueEmail).not.toHaveBeenCalled();
});

it('does nothing when surveys are disabled for the org', async () => {
  const d = deps({ loadCsatSettings: vi.fn(async () => ({ enabled: false, question: null })) });
  await processCsatSurvey(resolvedEvent(), d);
  expect(d.createSurvey).not.toHaveBeenCalled();
  expect(d.enqueueEmail).not.toHaveBeenCalled();
});

it('does not email twice: a ticket resolved then closed only surveys once', async () => {
  const d = deps({ createSurvey: vi.fn(async () => false) }); // second call: row already exists
  await processCsatSurvey(resolvedEvent('agent-2', 'closed'), d);
  expect(d.enqueueEmail).not.toHaveBeenCalled();
});

it('creates the survey but skips the email when the requester resolved their own ticket', async () => {
  const d = deps();
  await processCsatSurvey(resolvedEvent('req-1'), d);
  expect(d.createSurvey).toHaveBeenCalled();
  expect(d.enqueueEmail).not.toHaveBeenCalled();
});

it('creates the survey but skips the email when org outbound email is off', async () => {
  const d = deps({ orgEmailEnabled: vi.fn(async () => false) });
  await processCsatSurvey(resolvedEvent(), d);
  expect(d.createSurvey).toHaveBeenCalled();
  expect(d.enqueueEmail).not.toHaveBeenCalled();
});

it('respects the requester email-disabled preference', async () => {
  const d = deps({ loadPrefs: vi.fn(async () => ({ 'req-1': { emailEnabled: false, assigned: true, replies: true, statusChanges: true } })) });
  await processCsatSurvey(resolvedEvent(), d);
  expect(d.createSurvey).toHaveBeenCalled();
  expect(d.enqueueEmail).not.toHaveBeenCalled();
});

it('does nothing when the ticket has no requester', async () => {
  const d = deps({ loadTicket: vi.fn(async () => ({ id: 't1', number: 7, title: 'Printer', requesterId: null, assigneeId: 'agent-2', teamId: null })) });
  await processCsatSurvey(resolvedEvent(), d);
  expect(d.createSurvey).not.toHaveBeenCalled();
});
