// SPDX-License-Identifier: AGPL-3.0-only

import { generateObject, type LanguageModel } from 'ai';
import { askPlanSchema, type AskPlan } from './schema';
import { buildPlanPrompt } from './prompts';
import { redactPii } from '../redact';

/** Translate a natural-language request into a flat query plan. */
export async function planQuery(input: { model: LanguageModel; query: string; now: string; botName?: string }): Promise<AskPlan> {
  // Guardrail: strip PII from the user's question before it reaches OpenAI.
  const { system, prompt } = buildPlanPrompt({ query: redactPii(input.query), now: input.now, botName: input.botName });
  const { object } = await generateObject({ model: input.model, schema: askPlanSchema, system, prompt });
  return object;
}
