// SPDX-License-Identifier: AGPL-3.0-only

import { it, expect, vi } from 'vitest';
import { processSlackSend, postSlackWebhook, type SlackSendDeps } from './send';

function deps(over: Partial<SlackSendDeps> = {}): SlackSendDeps {
  return {
    loadWebhook: vi.fn(async () => 'https://hooks.slack.com/services/T0/B0/xyz'),
    fetchFn: vi.fn(async () => new Response('ok', { status: 200 })) as unknown as typeof fetch,
    ...over,
  };
}

it('posts the pre-rendered payload to the org webhook', async () => {
  const d = deps();
  await processSlackSend({ orgId: 'o1', text: 'hello', blocks: [{ type: 'section' }] }, d);
  const [url, init] = (d.fetchFn as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
  expect(url).toBe('https://hooks.slack.com/services/T0/B0/xyz');
  expect(init.method).toBe('POST');
  expect(JSON.parse(init.body as string)).toEqual({ text: 'hello', blocks: [{ type: 'section' }] });
});

it('skips silently when the integration is disabled/unconfigured', async () => {
  const d = deps({ loadWebhook: vi.fn(async () => null) });
  await processSlackSend({ orgId: 'o1', text: 'hello' }, d);
  expect(d.fetchFn).not.toHaveBeenCalled();
});

it('throws on a non-2xx webhook response (so the job retries)', async () => {
  const fetchFn = vi.fn(async () => new Response('invalid_token', { status: 403 })) as unknown as typeof fetch;
  await expect(postSlackWebhook(fetchFn, 'https://hooks.slack.com/x', { text: 'hi' })).rejects.toThrow(/403/);
});
