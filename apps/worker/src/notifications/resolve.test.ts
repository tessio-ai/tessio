// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { resolveRecipients, type ResolveInput } from './resolve';

const base: ResolveInput = {
  eventType: 'commented',
  actorId: 'agent-1',
  internal: false,
  requesterId: 'req-1',
  assigneeId: 'agent-2',
  changes: undefined,
};

describe('resolveRecipients', () => {
  it('public agent reply → requester gets a reply notification', () => {
    expect(resolveRecipients(base)).toEqual([{ userId: 'req-1', type: 'reply' }]);
  });
  it('requester reply → assignee gets a reply notification', () => {
    expect(resolveRecipients({ ...base, actorId: 'req-1' })).toEqual([{ userId: 'agent-2', type: 'reply' }]);
  });
  it('internal note → assignee only, never the requester', () => {
    expect(resolveRecipients({ ...base, internal: true })).toEqual([{ userId: 'agent-2', type: 'reply' }]);
  });
  it('never notifies the actor of their own action', () => {
    expect(resolveRecipients({ ...base, actorId: 'agent-2' })).toEqual([{ userId: 'req-1', type: 'reply' }]);
  });
  it('assignment → only the new assignee, as assigned', () => {
    expect(resolveRecipients({ eventType: 'assigned', actorId: 'agent-1', internal: false, requesterId: 'req-1', assigneeId: 'agent-2', changes: { assigneeId: 'agent-2' } }))
      .toEqual([{ userId: 'agent-2', type: 'assigned' }]);
  });
  it('status change → requester gets a status notification', () => {
    expect(resolveRecipients({ eventType: 'resolved', actorId: 'agent-2', internal: false, requesterId: 'req-1', assigneeId: 'agent-2', changes: undefined }))
      .toEqual([{ userId: 'req-1', type: 'status' }]);
  });
  it('created with an assignee → assignee gets an assigned notification', () => {
    expect(resolveRecipients({ eventType: 'created', actorId: 'req-1', internal: false, requesterId: 'req-1', assigneeId: 'agent-2', changes: undefined }))
      .toEqual([{ userId: 'agent-2', type: 'assigned' }]);
  });
});
