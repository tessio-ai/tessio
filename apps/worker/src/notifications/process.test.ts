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
