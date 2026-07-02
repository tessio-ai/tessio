// SPDX-License-Identifier: AGPL-3.0-only

import { aiProvider, type AiProvider, type AiSettings } from './settings';

/** Bring-your-own-LLM configuration read from the environment. */
export interface AiEnvOverrides {
  provider?: AiProvider;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  embeddingModel?: string;
}

/**
 * Read BYO-LLM config from the environment — the self-host bring-your-own-key
 * path. `TESSIO_AI_API_KEY` (or `OPENAI_API_KEY`), `TESSIO_AI_PROVIDER`,
 * `TESSIO_AI_BASE_URL`, `TESSIO_AI_MODEL`, `TESSIO_AI_EMBEDDING_MODEL`.
 */
export function aiEnvOverrides(env: NodeJS.ProcessEnv = process.env): AiEnvOverrides {
  const out: AiEnvOverrides = {};
  const provider = env.TESSIO_AI_PROVIDER;
  if (provider && aiProvider.safeParse(provider).success) out.provider = provider as AiProvider;
  const key = env.TESSIO_AI_API_KEY ?? env.OPENAI_API_KEY;
  if (key) out.apiKey = key;
  if (env.TESSIO_AI_BASE_URL) out.baseUrl = env.TESSIO_AI_BASE_URL;
  if (env.TESSIO_AI_MODEL) out.model = env.TESSIO_AI_MODEL;
  if (env.TESSIO_AI_EMBEDDING_MODEL) out.embeddingModel = env.TESSIO_AI_EMBEDDING_MODEL;
  return out;
}

/**
 * Merge env fallbacks into DB-derived settings. The stored per-org value wins
 * whenever it is set; env only fills gaps — so a single-org self-host can
 * configure everything via .env, while multi-tenant orgs configure in-app. When
 * an org has no key of its own and relies on the env key, the env provider/base
 * URL apply too.
 */
export function applyAiEnvFallback(settings: AiSettings, env: NodeJS.ProcessEnv = process.env): AiSettings {
  const e = aiEnvOverrides(env);
  const usingEnvKey = !settings.apiKey && !!e.apiKey;
  return {
    ...settings,
    apiKey: settings.apiKey ?? e.apiKey ?? null,
    baseUrl: settings.baseUrl ?? e.baseUrl ?? null,
    model: settings.model || e.model || '',
    embeddingModel: settings.embeddingModel || e.embeddingModel || settings.embeddingModel,
    provider: usingEnvKey && e.provider ? e.provider : settings.provider,
  };
}
