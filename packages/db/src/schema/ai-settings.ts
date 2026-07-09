// SPDX-License-Identifier: AGPL-3.0-only

import { pgTable, uuid, text, boolean, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { orgs } from './orgs';
import { users } from './users';

export interface AiFeatureFlags {
  summary: boolean;
  draft: boolean;
  triage: boolean;
  similar: boolean;
  ask: boolean;
}

/** One row per org — Tess AI configuration (OpenAI). The API key is stored encrypted. */
export const aiSettings = pgTable('ai_settings', {
  orgId: uuid('org_id').primaryKey().references(() => orgs.id),
  enabled: boolean('enabled').notNull().default(false),
  // LLM provider: 'openai' (default) or 'openai-compatible' (uses baseUrl for
  // Azure/Ollama/LM Studio/local). See @tessio/ai AiProvider.
  provider: text('provider').notNull().default('openai'),
  baseUrl: text('base_url'),
  // Empty default lets getOrCreate insert a lazy row; the API rejects enabled+blank model.
  model: text('model').notNull().default(''),
  embeddingModel: text('embedding_model').notNull().default('text-embedding-3-small'),
  apiKeyCiphertext: text('api_key_ciphertext'),
  apiKeyHint: text('api_key_hint'),
  // Assistant identity — the display name used in the UI and LLM prompts, and
  // an optional emoji/monogram rendered inside the avatar orb (null = plain orb).
  botName: text('bot_name').notNull().default('Tess'),
  botIcon: text('bot_icon'),
  features: jsonb('features').$type<AiFeatureFlags>().notNull().default({ summary: false, draft: false, triage: false, similar: false, ask: false }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedBy: uuid('updated_by').references(() => users.id),
});
