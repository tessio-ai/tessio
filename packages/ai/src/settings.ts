// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod';

export const aiFeatures = z.object({
  summary: z.boolean(),
  draft: z.boolean(),
  triage: z.boolean(),
  similar: z.boolean(),
  ask: z.boolean(),
});
export type AiFeatures = z.infer<typeof aiFeatures>;

export const DEFAULT_AI_FEATURES: AiFeatures = {
  summary: false,
  draft: false,
  triage: false,
  similar: false,
  ask: false,
};

/**
 * LLM provider. `openai` talks to the OpenAI API; `openai-compatible` talks to
 * any OpenAI-compatible endpoint via `baseUrl` (Azure OpenAI, Ollama, LM Studio,
 * vLLM, a local gateway, …) — so self-host can bring its own model, including a
 * fully local one with no outbound egress. New first-class providers (e.g.
 * Anthropic) get a new value here plus a case in createTessClient.
 */
export const aiProvider = z.enum(['openai', 'openai-compatible']);
export type AiProvider = z.infer<typeof aiProvider>;
export const DEFAULT_AI_PROVIDER: AiProvider = 'openai';

/** Resolved settings used at call time — includes the decrypted key. Never sent to clients. */
export interface AiSettings {
  enabled: boolean;
  provider: AiProvider;
  /** Custom OpenAI-compatible base URL (required for `openai-compatible`; null = provider default). */
  baseUrl: string | null;
  model: string; // chat model (summary/draft/triage)
  embeddingModel: string; // embedding model (similar tickets)
  apiKey: string | null;
  features: AiFeatures;
}

export const triagePriority = z.enum(['low', 'medium', 'high', 'urgent']);
export type TriagePriority = z.infer<typeof triagePriority>;
