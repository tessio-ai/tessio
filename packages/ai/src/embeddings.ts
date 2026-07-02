// SPDX-License-Identifier: AGPL-3.0-only

import { createHash } from 'node:crypto';
import { embed, embedMany } from 'ai';
import { embeddingModelFor } from './client';
import { redactPii } from './redact';

/** All embeddings are produced at this fixed dimension so the pgvector column is never ragged. */
export const EMBEDDING_DIMENSIONS = 1536;

/** Stable content fingerprint used to skip re-embedding unchanged tickets. */
export function contentHash(title: string, description: string): string {
  return createHash('sha256').update(`${title}\n${description}`).digest('hex');
}

interface EmbedArgs {
  apiKey: string;
  model: string;
  /** Optional OpenAI-compatible base URL (BYO/local provider). */
  baseUrl?: string | null;
}

/** Embed a single string. Returns a 1536-dim vector. */
export async function embedText({ apiKey, model, baseUrl, text }: EmbedArgs & { text: string }): Promise<number[]> {
  const { embedding } = await embed({
    model: embeddingModelFor({ apiKey, model, baseUrl }),
    value: redactPii(text), // Guardrail: never embed raw PII.
    providerOptions: { openai: { dimensions: EMBEDDING_DIMENSIONS } },
  });
  return embedding;
}

/** Embed many strings in one request (used by backfill). */
export async function embedTexts({ apiKey, model, baseUrl, texts }: EmbedArgs & { texts: string[] }): Promise<number[][]> {
  if (texts.length === 0) return [];
  const { embeddings } = await embedMany({
    model: embeddingModelFor({ apiKey, model, baseUrl }),
    values: texts.map(redactPii), // Guardrail: never embed raw PII.
    providerOptions: { openai: { dimensions: EMBEDDING_DIMENSIONS } },
  });
  return embeddings;
}
