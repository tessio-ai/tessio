// SPDX-License-Identifier: AGPL-3.0-only

import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Db } from '@tessio/db';
import { aiSettingsRepo } from '@tessio/db';
import { aiProvider } from '@tessio/ai';
import { aiFeatures, createTessClient, encryptSecret, generateObjectProbe } from './ai-settings-helpers';
import { resolveAiSettings } from '../ai/resolve';
import { requireSecretKey } from '../ai/secret';
import { recordAudit, safeMeta } from '../audit';

const settingsResponse = z.object({
  enabled: z.boolean(),
  provider: aiProvider,
  baseUrl: z.string().nullable(),
  model: z.string(),
  embeddingModel: z.string(),
  apiKeyHint: z.string().nullable(),
  apiKeySet: z.boolean(),
  features: aiFeatures,
});

const putBody = z.object({
  enabled: z.boolean().optional(),
  provider: aiProvider.optional(),
  baseUrl: z.string().nullable().optional(),
  model: z.string().optional(),
  embeddingModel: z.string().optional(),
  apiKey: z.string().optional(), // when present, replaces the stored key
  features: aiFeatures.partial().optional(),
});

const testResponse = z.object({ ok: z.boolean(), error: z.string().optional() });

function present(row: Awaited<ReturnType<ReturnType<typeof aiSettingsRepo>['getOrCreate']>>) {
  return {
    enabled: row.enabled,
    provider: aiProvider.catch('openai').parse(row.provider),
    baseUrl: row.baseUrl,
    model: row.model,
    embeddingModel: row.embeddingModel,
    apiKeyHint: row.apiKeyHint,
    apiKeySet: !!row.apiKeyCiphertext,
    features: row.features,
  };
}

/** Admin-only Tess AI settings. Caller must be guarded by requireRole('admin'). */
export function registerAiSettingsRoutes(app: FastifyInstance, db: Db): void {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const repo = aiSettingsRepo(db);

  r.get('/ai/settings', { schema: { response: { 200: settingsResponse } } }, async (req) => {
    return present(await repo.getOrCreate(req.orgId));
  });

  r.put('/ai/settings', { schema: { body: putBody, response: { 200: settingsResponse } } }, async (req) => {
    await repo.getOrCreate(req.orgId);
    const body = req.body;
    const patch: Record<string, unknown> = { updatedBy: req.user.id };
    if (body.enabled !== undefined) patch.enabled = body.enabled;
    if (body.provider !== undefined) patch.provider = body.provider;
    if (body.baseUrl !== undefined) patch.baseUrl = body.baseUrl;
    if (body.model !== undefined) patch.model = body.model;
    if (body.embeddingModel !== undefined) patch.embeddingModel = body.embeddingModel;
    if (body.features !== undefined) {
      const current = (await repo.getOrCreate(req.orgId)).features;
      patch.features = { ...current, ...body.features };
    }
    if (body.apiKey) {
      patch.apiKeyCiphertext = encryptSecret(body.apiKey, requireSecretKey());
      patch.apiKeyHint = body.apiKey.slice(-4);
    }
    const updated = await repo.update(req.orgId, patch);
    void recordAudit(db, { orgId: req.orgId, actorId: req.user.id, actorEmail: req.user.email, action: 'settings.ai.updated', metadata: safeMeta(req.body as Record<string, unknown>, ['enabled', 'inboundEnabled', 'autoCreateUsers', 'acceptNewSenders']), ip: req.ip });
    return present(updated);
  });

  r.post('/ai/settings/test', { schema: { response: { 200: testResponse } } }, async (req) => {
    try {
      const settings = await resolveAiSettings(db, req.orgId);
      if (!settings.model) return { ok: false, error: 'No model configured' };
      const model = createTessClient(settings);
      await generateObjectProbe(model);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });
}
