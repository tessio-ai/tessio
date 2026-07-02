// SPDX-License-Identifier: AGPL-3.0-only

import { createOpenAI } from '@ai-sdk/openai';
import { wrapLanguageModel, type LanguageModel, type EmbeddingModel } from 'ai';
import type { AiSettings } from './settings';

/** The exact model type wrapLanguageModel accepts (not exported by name from 'ai'). */
type WrappableModel = Parameters<typeof wrapLanguageModel>[0]['model'];

/**
 * The single provider-agnostic seam for all LLM access. Every Tess feature
 * builds its model handle here, so swapping or adding providers — and attaching
 * usage metering — happens in exactly one place.
 *
 * Self-host posture: no model is ever contacted unless an org (or env) supplies
 * an API key, and `openai-compatible` + `baseUrl` lets self-host point at a
 * local model for zero outbound egress.
 */

/** Per-call usage captured by the optional metering middleware. */
export interface AiUsage {
  provider: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

/** Sink for usage events. Injected by the hosted build; a no-op in self-host. */
export type OnUsage = (usage: AiUsage) => void;

export interface TessClientOptions {
  /**
   * Metering hook. When provided, the returned model is wrapped to report token
   * usage per call. Omitted in self-host → the bare model, zero overhead.
   */
  onUsage?: OnUsage;
}

/** Build the underlying provider for the given key + optional base URL. */
function providerFor(apiKey: string, baseUrl: string | null) {
  // Both `openai` and `openai-compatible` use the OpenAI provider; a non-null
  // baseUrl redirects it at an OpenAI-compatible endpoint (Azure/Ollama/local).
  return createOpenAI(baseUrl ? { apiKey, baseURL: baseUrl } : { apiKey });
}

function requireKey(settings: AiSettings): string {
  if (!settings.apiKey) throw new Error('Tess AI requires an API key');
  return settings.apiKey;
}

/** Build a chat model handle from resolved (decrypted) settings. Pure — no network. */
export function createTessClient(settings: AiSettings, opts?: TessClientOptions): LanguageModel {
  const apiKey = requireKey(settings);
  const provider = providerFor(apiKey, settings.baseUrl);
  // `provider` is OpenAI-compatible for both supported values today; the switch
  // is the extension point for future first-class providers.
  switch (settings.provider) {
    case 'openai':
    case 'openai-compatible': {
      const model = provider(settings.model);
      return opts?.onUsage ? meterModel(model, settings, opts.onUsage) : model;
    }
  }
}

/** Build an embedding model handle from resolved settings (same provider seam). */
export function createTessEmbeddingModel(settings: AiSettings): EmbeddingModel {
  const apiKey = requireKey(settings);
  return providerFor(apiKey, settings.baseUrl).embeddingModel(settings.embeddingModel);
}

/** Lower-level embedding-model builder used by the embeddings module. */
export function embeddingModelFor(args: { apiKey: string; model: string; baseUrl?: string | null }): EmbeddingModel {
  return providerFor(args.apiKey, args.baseUrl ?? null).embeddingModel(args.model);
}

/** Extract flat token counts from the AI SDK's nested usage shape. */
function tokensFrom(u: { inputTokens?: { total?: number }; outputTokens?: { total?: number } }): {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
} {
  const inputTokens = u.inputTokens?.total;
  const outputTokens = u.outputTokens?.total;
  const totalTokens =
    inputTokens === undefined && outputTokens === undefined ? undefined : (inputTokens ?? 0) + (outputTokens ?? 0);
  return { inputTokens, outputTokens, totalTokens };
}

/** Wrap a chat model so every call reports token usage to `onUsage`. */
function meterModel(model: LanguageModel, settings: AiSettings, onUsage: OnUsage): LanguageModel {
  const report = (counts: ReturnType<typeof tokensFrom>): void =>
    onUsage({ provider: settings.provider, model: settings.model, ...counts });
  return wrapLanguageModel({
    model: model as WrappableModel,
    middleware: {
      specificationVersion: 'v3',
      wrapGenerate: async ({ doGenerate }) => {
        const result = await doGenerate();
        report(tokensFrom(result.usage));
        return result;
      },
      wrapStream: async ({ doStream }) => {
        const { stream, ...rest } = await doStream();
        const metered = stream.pipeThrough(
          new TransformStream({
            transform(chunk, controller) {
              if (chunk.type === 'finish') report(tokensFrom(chunk.usage));
              controller.enqueue(chunk);
            },
          }),
        );
        return { stream: metered, ...rest };
      },
    },
  });
}
