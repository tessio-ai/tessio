// SPDX-License-Identifier: AGPL-3.0-only

import type { Db } from '@tessio/db';
import { aiSettingsRepo } from '@tessio/db';
import { decryptSecret, applyAiEnvFallback, type AiProvider, type AiSettings } from '@tessio/ai';
import { requireSecretKey } from './secret';

/**
 * Load the org's AI settings and decrypt the key into a ready-to-use AiSettings.
 * Stored per-org values win; any gaps are filled from BYO-LLM env vars
 * (TESSIO_AI_* and OPENAI_API_KEY) so a single-org self-host can configure via .env.
 */
export async function resolveAiSettings(db: Db, orgId: string): Promise<AiSettings> {
  const row = await aiSettingsRepo(db).getOrCreate(orgId);
  const apiKey = row.apiKeyCiphertext ? decryptSecret(row.apiKeyCiphertext, requireSecretKey()) : null;
  return applyAiEnvFallback({
    enabled: row.enabled,
    provider: row.provider as AiProvider,
    baseUrl: row.baseUrl,
    model: row.model,
    embeddingModel: row.embeddingModel,
    apiKey,
    features: row.features,
  });
}
