// SPDX-License-Identifier: AGPL-3.0-only

import { streamText, type LanguageModel } from 'ai';
import { buildSummarizePrompt, type TicketContext, type CommentContext } from '../prompts/summarize';
import { redactTicketFields, redactCommentBodies } from '../redact';

/** Returns the AI SDK stream result; caller pipes `.textStream`. */
export function streamTicketSummary(input: { model: LanguageModel; ticket: TicketContext; comments: CommentContext[]; botName?: string }) {
  // Guardrail: strip PII from ticket + comments before they reach OpenAI.
  const ticket = redactTicketFields(input.ticket);
  const comments = redactCommentBodies(input.comments);
  const { system, prompt } = buildSummarizePrompt({ ticket, comments, botName: input.botName });
  return streamText({ model: input.model, system, prompt });
}
