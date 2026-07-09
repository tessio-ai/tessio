// SPDX-License-Identifier: AGPL-3.0-only

import { it, expect, vi } from 'vitest';
import { processNotificationEvent, type NotifyDeps } from './process';

function deps(over: Partial<NotifyDeps> = {}): NotifyDeps {
  return {
    loadTicket: vi.fn(async () => ({ id: 't1', number: 7, title: 'Printer', requesterId: 'req-1', assigneeId: 'agent-2' })),
    loadPrefs: vi.fn(async () => ({ 'req-1': { emailEnabled: true, assigned: true, replies: true, statusChanges: true } })),
    loadEmail: vi.fn(async (id: string) => (id === 'req-1' ? 'req@x.com' : null)),
    createNotifications: vi.fn(async () => {}),
    enqueueEmail: vi.fn(async () => {}),
    orgEmailEnabled: vi.fn(async () => true),
    fromDomain: vi.fn(async () => 'desk.acme.com'),
    orgSlack: vi.fn(async () => null),
    enqueueSlack: vi.fn(async () => {}),
    siteUrl: 'https://desk.acme.com',
    ...over,
  };
}

it('writes a feed row and enqueues an email for a public reply', async () => {
  const d = deps();
  await processNotificationEvent({ orgId: 'o1', event: { eventType: 'commented', recordId: 't1', actorId: 'agent-2', internal: false } }, d);
  expect(d.createNotifications).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ userId: 'req-1', type: 'reply' })]));
  expect(d.enqueueEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'req@x.com', orgId: 'o1' }));
});

it('does not email when the recipient pref is off (but still writes the feed row)', async () => {
  const d = deps({ loadPrefs: vi.fn(async () => ({ 'req-1': { emailEnabled: true, assigned: true, replies: false, statusChanges: true } })) });
  await processNotificationEvent({ orgId: 'o1', event: { eventType: 'commented', recordId: 't1', actorId: 'agent-2', internal: false } }, d);
  expect(d.createNotifications).toHaveBeenCalled();
  expect(d.enqueueEmail).not.toHaveBeenCalled();
});

it('does not email when org outbound is disabled', async () => {
  const d = deps({ orgEmailEnabled: vi.fn(async () => false) });
  await processNotificationEvent({ orgId: 'o1', event: { eventType: 'commented', recordId: 't1', actorId: 'agent-2', internal: false } }, d);
  expect(d.enqueueEmail).not.toHaveBeenCalled();
});

const SLACK_ALL = { created: true, assigned: true, status: true, commented: true };

it('enqueues a Slack message when the org toggle for the event is on', async () => {
  const d = deps({ orgSlack: vi.fn(async () => SLACK_ALL) });
  await processNotificationEvent({ orgId: 'o1', event: { eventType: 'status', recordId: 't1', actorId: 'agent-2', changes: { status: 'resolved' } } }, d);
  expect(d.enqueueSlack).toHaveBeenCalledWith(expect.objectContaining({
    orgId: 'o1',
    text: expect.stringContaining('#7 Printer'),
    blocks: expect.any(Array),
  }));
});

it('posts to Slack even when there are no per-user recipients', async () => {
  // A ticket created by its own requester notifies nobody individually, but the channel still hears about it.
  const d = deps({
    orgSlack: vi.fn(async () => SLACK_ALL),
    loadTicket: vi.fn(async () => ({ id: 't1', number: 7, title: 'Printer', requesterId: 'req-1', assigneeId: null })),
  });
  await processNotificationEvent({ orgId: 'o1', event: { eventType: 'created', recordId: 't1', actorId: 'req-1' } }, d);
  expect(d.enqueueSlack).toHaveBeenCalled();
});

it('does not post to Slack when the event toggle is off or the integration is disabled', async () => {
  const toggledOff = deps({ orgSlack: vi.fn(async () => ({ ...SLACK_ALL, commented: false })) });
  await processNotificationEvent({ orgId: 'o1', event: { eventType: 'commented', recordId: 't1', actorId: 'agent-2' } }, toggledOff);
  expect(toggledOff.enqueueSlack).not.toHaveBeenCalled();

  const disabled = deps({ orgSlack: vi.fn(async () => null) });
  await processNotificationEvent({ orgId: 'o1', event: { eventType: 'created', recordId: 't1' } }, disabled);
  expect(disabled.enqueueSlack).not.toHaveBeenCalled();
});

it('does not post non-announceable events (priority/team/field changes) to Slack', async () => {
  const d = deps({ orgSlack: vi.fn(async () => SLACK_ALL) });
  await processNotificationEvent({ orgId: 'o1', event: { eventType: 'priority', recordId: 't1', changes: { priority: 'high' } } }, d);
  expect(d.orgSlack).not.toHaveBeenCalled();
  expect(d.enqueueSlack).not.toHaveBeenCalled();
});
