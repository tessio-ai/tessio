// SPDX-License-Identifier: AGPL-3.0-only

import { streamText, type LanguageModel } from 'ai';
import { buildDraftPrompt } from '../prompts/draft';
import type { TicketContext, CommentContext } from '../prompts/summarize';
import { redactTicketFields, redactCommentBodies } from '../redact';

export function streamDraftReply(input: {
  model: LanguageModel;
  ticket: TicketContext;
  comments: CommentContext[];
  requesterName: string | null;
}) {
  // Guardrail: strip PII from ticket + comments before they reach OpenAI.
  const { system, prompt } = buildDraftPrompt({
    ticket: redactTicketFields(input.ticket),
    comments: redactCommentBodies(input.comments),
    requesterName: input.requesterName,
  });
  return streamText({ model: input.model, system, prompt });
}
