// SPDX-License-Identifier: AGPL-3.0-only

export const AI_TRIAGE_QUEUE = 'ai-triage';
export const AI_EMBED_QUEUE = 'ai-embed';

export { encryptSecret, decryptSecret } from './crypto';
export {
  aiFeatures,
  aiProvider,
  triagePriority,
  DEFAULT_AI_FEATURES,
  DEFAULT_AI_PROVIDER,
  type AiFeatures,
  type AiProvider,
  type AiSettings,
  type TriagePriority,
} from './settings';
export {
  createTessClient,
  createTessEmbeddingModel,
  embeddingModelFor,
  type AiUsage,
  type OnUsage,
  type TessClientOptions,
} from './client';
export { aiEnvOverrides, applyAiEnvFallback, type AiEnvOverrides } from './env';
export { streamTicketSummary } from './features/summarize';
export { streamDraftReply } from './features/draft';
export { triageTicket, triageResultSchema, type TriageResult } from './features/triage';
export type { TicketContext, CommentContext } from './prompts/summarize';
export type { CandidateAgent } from './prompts/triage';
export { embedText, embedTexts, contentHash, EMBEDDING_DIMENSIONS } from './embeddings';
export { redactPii, redactTicketFields, redactCommentBodies } from './redact';
export { planQuery } from './ask/plan';
export { generateAskAnswer } from './ask/answer';
export { planToFilter, ALLOWED_ASK_FIELDS } from './ask/to-filter';
export { askPlanSchema, type AskPlan, type AskLeaf } from './ask/schema';
export type { CompactTicket } from './ask/prompts';
