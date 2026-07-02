// SPDX-License-Identifier: AGPL-3.0-only

import type { EmailSendJob } from '@tessio/shared';
import type { Mailer } from './mailer';
export interface SendDeps { loadMailer(orgId: string): Promise<Mailer | null>; }
export async function processEmailSend(job: EmailSendJob, deps: SendDeps): Promise<void> {
  const mailer = await deps.loadMailer(job.orgId);
  if (!mailer) return; // org not configured — nothing to send
  await mailer.send({ to: job.to, subject: job.subject, text: job.text, html: job.html, headers: job.headers });
}
