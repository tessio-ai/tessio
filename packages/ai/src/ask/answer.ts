// SPDX-License-Identifier: AGPL-3.0-only

import { generateText, type LanguageModel } from 'ai';
import { buildAnswerPrompt, type CompactTicket } from './prompts';
import { redactPii } from '../redact';

/** Write a grounded answer over the fetched tickets. */
export async function generateAskAnswer(input: { model: LanguageModel; query: string; tickets: CompactTicket[]; botName?: string }): Promise<string> {
  // Guardrail: strip PII from the question and the ticket titles before they reach OpenAI.
  const query = redactPii(input.query);
  const tickets = input.tickets.map((t) => ({ ...t, title: redactPii(t.title) }));
  const { system, prompt } = buildAnswerPrompt({ query, tickets, botName: input.botName });
  const { text } = await generateText({ model: input.model, system, prompt });
  return text;
}
