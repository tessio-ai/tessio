// SPDX-License-Identifier: AGPL-3.0-only

import { it, expect, vi } from 'vitest';
import { processEmailSend, type SendDeps } from './send';
import type { EmailSendJob } from '@tessio/shared';

const JOB: EmailSendJob = {
  orgId: 'o1',
  to: 'user@example.com',
  subject: '[#7] Printer is broken',
  text: 'There is a new reply on your ticket.\n\nYou have a new reply.\n\nView ticket: https://desk.acme.com/#/tickets/t1',
  html: '<p>There is a new reply on your ticket.</p>',
};

it('calls mailer.send with the job fields when a mailer is configured', async () => {
  const send = vi.fn(async () => ({}));
  const deps: SendDeps = { loadMailer: vi.fn(async () => ({ send })) };
  await processEmailSend(JOB, deps);
  expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: JOB.to, subject: JOB.subject }));
});

it('does not call send and does not throw when loadMailer returns null', async () => {
  const send = vi.fn(async () => ({}));
  const deps: SendDeps = { loadMailer: vi.fn(async () => null) };
  await expect(processEmailSend(JOB, deps)).resolves.toBeUndefined();
  expect(send).not.toHaveBeenCalled();
});
