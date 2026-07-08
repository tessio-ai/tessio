// SPDX-License-Identifier: AGPL-3.0-only

import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Db } from '@tessio/db';
import { slackSettingsRepo } from '@tessio/db';
import { encryptSecret, decryptSecret } from '@tessio/ai';
import { slackSettingsInput, isValidSlackWebhookUrl, buildSlackTestMessage } from '@tessio/shared';
import { requireSecretKey } from '../ai/secret';
import { ApiError } from '../errors';
import { recordAudit, safeMeta } from '../audit';

/** Timeout for the "send test message" button, so a bad webhook fails in seconds. */
const SLACK_TEST_TIMEOUT_MS = Number(process.env.SLACK_TEST_TIMEOUT_MS ?? 12000);

const settingsResponse = z.object({
  orgId: z.string(),
  enabled: z.boolean(),
  webhookConfigured: z.boolean(),
  notifyCreated: z.boolean(),
  notifyAssigned: z.boolean(),
  notifyStatus: z.boolean(),
  notifyCommented: z.boolean(),
  notifySlaBreach: z.boolean(),
});

type SlackSettingsRow = Awaited<ReturnType<ReturnType<typeof slackSettingsRepo>['getOrCreate']>>;

function present(row: NonNullable<SlackSettingsRow>) {
  return {
    orgId: row.orgId,
    enabled: row.enabled,
    webhookConfigured: !!row.webhookUrlCiphertext,
    notifyCreated: row.notifyCreated,
    notifyAssigned: row.notifyAssigned,
    notifyStatus: row.notifyStatus,
    notifyCommented: row.notifyCommented,
    notifySlaBreach: row.notifySlaBreach,
  };
}

/** Admin-only Slack integration settings. Caller must be guarded by requireRole('admin'). */
export function registerSlackSettingsRoutes(app: FastifyInstance, db: Db): void {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const repo = slackSettingsRepo(db);

  r.get('/slack-settings', { schema: { response: { 200: settingsResponse } } }, async (req) => {
    return present(await repo.getOrCreate(req.orgId));
  });

  r.put('/slack-settings', { schema: { body: slackSettingsInput, response: { 200: settingsResponse } } }, async (req) => {
    const existing = await repo.getOrCreate(req.orgId);
    const body = req.body;
    const patch: Record<string, unknown> = { updatedBy: req.user.id };

    if (body.enabled !== undefined) patch.enabled = body.enabled;
    if (body.webhookUrl) {
      if (!isValidSlackWebhookUrl(body.webhookUrl)) {
        throw new ApiError(400, 'Invalid Webhook URL', 'The webhook URL must be a valid https:// URL (e.g. https://hooks.slack.com/services/…).');
      }
      patch.webhookUrlCiphertext = encryptSecret(body.webhookUrl, requireSecretKey());
    }
    if (body.notifyCreated !== undefined) patch.notifyCreated = body.notifyCreated;
    if (body.notifyAssigned !== undefined) patch.notifyAssigned = body.notifyAssigned;
    if (body.notifyStatus !== undefined) patch.notifyStatus = body.notifyStatus;
    if (body.notifyCommented !== undefined) patch.notifyCommented = body.notifyCommented;
    if (body.notifySlaBreach !== undefined) patch.notifySlaBreach = body.notifySlaBreach;

    // Guard: the integration cannot be enabled without a webhook URL.
    const effectiveEnabled = patch.enabled !== undefined ? patch.enabled : existing.enabled;
    const hasWebhook = !!patch.webhookUrlCiphertext || !!existing.webhookUrlCiphertext;
    if (effectiveEnabled && !hasWebhook) {
      throw new ApiError(400, 'Missing Webhook URL', 'A webhook URL is required to enable the Slack integration.');
    }

    const updated = await repo.update(req.orgId, patch);
    void recordAudit(db, { orgId: req.orgId, actorId: req.user.id, actorEmail: req.user.email, action: 'settings.slack.updated', metadata: safeMeta(req.body as Record<string, unknown>, ['enabled', 'notifyCreated', 'notifyAssigned', 'notifyStatus', 'notifyCommented', 'notifySlaBreach']), ip: req.ip });
    return present(updated);
  });

  r.post('/slack-settings/test', { schema: { response: { 200: z.object({ ok: z.boolean() }) } } }, async (req) => {
    const row = await repo.getOrCreate(req.orgId);
    if (!row.webhookUrlCiphertext) {
      throw new ApiError(400, 'Slack Not Configured', 'Save a webhook URL before testing.');
    }
    const webhookUrl = decryptSecret(row.webhookUrlCiphertext, requireSecretKey());
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SLACK_TEST_TIMEOUT_MS);
    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(buildSlackTestMessage()),
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error(`Webhook responded ${res.status} ${(await res.text()).slice(0, 200)}`.trim());
      }
      return { ok: true };
    } catch (err) {
      throw new ApiError(400, 'Slack Test Failed', (err as Error).message);
    } finally {
      clearTimeout(timer);
    }
  });
}
