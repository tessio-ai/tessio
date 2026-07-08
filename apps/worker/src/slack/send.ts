// SPDX-License-Identifier: AGPL-3.0-only

import type { SlackSendJob } from '@tessio/shared';

export const SLACK_POST_TIMEOUT_MS = 10_000;

export interface SlackSendDeps {
  /** The org's decrypted webhook URL, or null when the integration is disabled/unconfigured. */
  loadWebhook(orgId: string): Promise<string | null>;
  fetchFn: typeof fetch;
}

/** POST a message payload to an incoming webhook; throws on a non-2xx response so BullMQ retries. */
export async function postSlackWebhook(
  fetchFn: typeof fetch,
  webhookUrl: string,
  payload: { text: string; blocks?: unknown[] },
): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SLACK_POST_TIMEOUT_MS);
  try {
    const res = await fetchFn(webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`Slack webhook responded ${res.status} ${(await res.text()).slice(0, 200)}`.trim());
    }
  } finally {
    clearTimeout(timer);
  }
}

/** The slack-send job processor: resolve the org webhook and post the pre-rendered message. */
export async function processSlackSend(job: SlackSendJob, deps: SlackSendDeps): Promise<void> {
  const webhookUrl = await deps.loadWebhook(job.orgId);
  if (!webhookUrl) return; // integration turned off since the job was enqueued
  await postSlackWebhook(deps.fetchFn, webhookUrl, { text: job.text, blocks: job.blocks });
}
