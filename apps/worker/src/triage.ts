// SPDX-License-Identifier: AGPL-3.0-only

import type { AiSettings, TicketContext, CandidateAgent, TriageResult } from '@tessio/ai';

export { AI_TRIAGE_QUEUE } from '@tessio/ai';

export interface TriageJobData {
  orgId: string;
  ticketId: string;
}

export interface TriageDeps {
  loadSettings: (orgId: string) => Promise<AiSettings>;
  loadTicket: (orgId: string, ticketId: string) => Promise<TicketContext | undefined>;
  loadCandidates: (orgId: string) => Promise<CandidateAgent[]>;
  runTriage: (settings: AiSettings, ticket: TicketContext, candidates: CandidateAgent[]) => Promise<TriageResult>;
  saveTriage: (input: {
    ticketId: string;
    category: string | null;
    priority: string | null;
    suggestedAssigneeId: string | null;
    confidence: number | null;
    reasoning: string | null;
  }) => Promise<void>;
  recordTriaged: (orgId: string, ticketId: string) => Promise<void>;
}

/** Pure orchestration — collaborators injected so it's unit-testable without DB/network. */
export async function processTriageJob(data: TriageJobData, deps: TriageDeps): Promise<void> {
  const settings = await deps.loadSettings(data.orgId);
  if (!settings.enabled || !settings.features.triage) return;
  const ticket = await deps.loadTicket(data.orgId, data.ticketId);
  if (!ticket) return;
  const candidates = await deps.loadCandidates(data.orgId);
  const result = await deps.runTriage(settings, ticket, candidates);
  await deps.saveTriage({
    ticketId: data.ticketId,
    category: result.category,
    priority: result.priority,
    suggestedAssigneeId: result.suggestedAssigneeId,
    confidence: result.confidence,
    reasoning: result.reasoning,
  });
  await deps.recordTriaged(data.orgId, data.ticketId);
}
