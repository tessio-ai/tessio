// SPDX-License-Identifier: AGPL-3.0-only

import { generateObject, type LanguageModel } from 'ai';
import { z } from 'zod';
import { triagePriority } from '../settings';
import { buildTriagePrompt, type CandidateAgent } from '../prompts/triage';
import type { TicketContext } from '../prompts/summarize';
import { redactPii, redactTicketFields } from '../redact';

export const triageResultSchema = z.object({
  category: z.string(),
  priority: triagePriority,
  suggestedAssigneeId: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});
export type TriageResult = z.infer<typeof triageResultSchema>;

export async function triageTicket(input: {
  model: LanguageModel;
  ticket: TicketContext;
  candidateAgents: CandidateAgent[];
  botName?: string;
}): Promise<TriageResult> {
  // Guardrail: strip PII from the ticket before it reaches OpenAI.
  const ticket = redactTicketFields(input.ticket);
  const { system, prompt } = buildTriagePrompt({ ticket, candidateAgents: input.candidateAgents, botName: input.botName });
  const { object } = await generateObject({
    model: input.model,
    schema: triageResultSchema,
    system,
    prompt,
  });
  // Guard: model may hallucinate an id not in the candidate set.
  const validIds = new Set(input.candidateAgents.map((a) => a.id));
  if (object.suggestedAssigneeId && !validIds.has(object.suggestedAssigneeId)) {
    object.suggestedAssigneeId = null;
  }
  // Defense in depth: the reasoning is persisted, so scrub it too.
  object.reasoning = redactPii(object.reasoning);
  return object;
}
