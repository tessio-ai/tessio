// SPDX-License-Identifier: AGPL-3.0-only

import { request, BASE_URL } from './client';

export interface AiFeatureFlags {
  summary: boolean;
  draft: boolean;
  triage: boolean;
  similar: boolean;
  ask: boolean;
}

export interface AiSettingsView {
  enabled: boolean;
  model: string;
  embeddingModel: string;
  apiKeyHint: string | null;
  apiKeySet: boolean;
  botName: string;
  botIcon: string | null;
  features: AiFeatureFlags;
}

export interface UpdateAiSettingsInput {
  enabled?: boolean;
  model?: string;
  embeddingModel?: string;
  apiKey?: string;
  botName?: string;
  botIcon?: string | null;
  features?: Partial<AiFeatureFlags>;
}

/** Assistant display name + avatar icon — readable by every authenticated role. */
export interface BotIdentity {
  name: string;
  icon: string | null;
}

export interface TicketTriage {
  ticketId: string;
  category: string | null;
  priority: string | null;
  suggestedAssigneeId: string | null;
  confidence: number | null;
  reasoning: string | null;
  triagedAt: string | null;
}

export const getBotIdentity = () => request<BotIdentity>('/ai/identity');

export const getAiSettings = () => request<AiSettingsView>('/ai/settings');
export const updateAiSettings = (patch: UpdateAiSettingsInput) =>
  request<AiSettingsView>('/ai/settings', { method: 'PUT', body: JSON.stringify(patch) });
export const testAiSettings = () =>
  request<{ ok: boolean; error?: string }>('/ai/settings/test', { method: 'POST' });

export const getTicketTriage = (ticketId: string) =>
  request<TicketTriage | null>(`/tickets/${ticketId}/ai/triage`);
export const runTicketTriage = (ticketId: string) =>
  request<TicketTriage>(`/tickets/${ticketId}/ai/triage`, { method: 'POST' });

/** Stream a plain-text AI response, invoking `onDelta` for each chunk. Returns the full text. */
async function streamText(path: string, onDelta: (chunk: string) => void, signal?: AbortSignal): Promise<string> {
  const res = await fetch(`${BASE_URL}${path}`, { method: 'POST', credentials: 'include', signal });
  if (!res.ok || !res.body) throw new Error(`AI request failed (${res.status})`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    full += chunk;
    onDelta(chunk);
  }
  const tail = decoder.decode();
  if (tail) { full += tail; onDelta(tail); }
  return full;
}

export const streamTicketSummary = (ticketId: string, onDelta: (c: string) => void, signal?: AbortSignal) =>
  streamText(`/tickets/${ticketId}/ai/summary`, onDelta, signal);
export const streamTicketDraft = (ticketId: string, onDelta: (c: string) => void, signal?: AbortSignal) =>
  streamText(`/tickets/${ticketId}/ai/draft`, onDelta, signal);

export interface SimilarTicket {
  id: string;
  number: number | null;
  title: string | null;
  status: string | null;
  assigneeId: string | null;
  score: number;
}

export const getSimilarTickets = (ticketId: string) =>
  request<SimilarTicket[]>(`/tickets/${ticketId}/ai/similar`);

export interface AskTicketRef {
  number: number | null;
  id: string;
  title: string;
  status: string | null;
}
export interface AskResult {
  answer: string;
  tickets: AskTicketRef[];
}
export const askTess = (query: string) =>
  request<AskResult>('/ai/ask', { method: 'POST', body: JSON.stringify({ query }) });
