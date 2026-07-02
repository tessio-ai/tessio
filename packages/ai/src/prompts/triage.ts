// SPDX-License-Identifier: AGPL-3.0-only

import type { TicketContext } from './summarize';

export interface CandidateAgent {
  id: string;
  name: string;
}

export function buildTriagePrompt(input: { ticket: TicketContext; candidateAgents: CandidateAgent[] }): {
  system: string;
  prompt: string;
} {
  const { ticket, candidateAgents } = input;
  const system =
    'You are Tess, an IT service-desk triage assistant. Classify the ticket and suggest an assignee. Choose suggestedAssigneeId ONLY from the provided candidate ids, or null if none clearly fits. confidence is 0–1. Keep reasoning to one short sentence.';
  const roster = candidateAgents.length
    ? candidateAgents.map((a) => `- ${a.id}: ${a.name}`).join('\n')
    : '(no candidates available — use null)';
  const prompt = [
    `Ticket #${ticket.number}: ${ticket.title}`,
    `Current category: ${ticket.category ?? 'uncategorized'}`,
    `Description: ${ticket.description || '(none)'}`,
    `Candidate agents (id: name):\n${roster}`,
  ].join('\n');
  return { system, prompt };
}
