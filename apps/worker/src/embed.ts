// SPDX-License-Identifier: AGPL-3.0-only

import { contentHash, type AiSettings } from '@tessio/ai';

export { AI_EMBED_QUEUE } from '@tessio/ai';

export interface EmbedJobData {
  orgId: string;
  ticketId: string;
}

export interface EmbedDeps {
  loadSettings: (orgId: string) => Promise<AiSettings>;
  loadTicketText: (orgId: string, ticketId: string) => Promise<{ title: string; description: string } | undefined>;
  getExistingHash: (ticketId: string) => Promise<string | null>;
  embed: (settings: AiSettings, text: string) => Promise<number[]>;
  saveEmbedding: (input: { ticketId: string; orgId: string; embedding: number[]; contentHash: string; model: string }) => Promise<void>;
}

/** Pure orchestration — collaborators injected so it's unit-testable without DB/network. */
export async function processEmbedJob(data: EmbedJobData, deps: EmbedDeps): Promise<void> {
  const settings = await deps.loadSettings(data.orgId);
  if (!settings.enabled || !settings.features.similar) return;
  if (!settings.apiKey) return; // no key configured → nothing to embed
  const t = await deps.loadTicketText(data.orgId, data.ticketId);
  if (!t) return;
  const hash = contentHash(t.title, t.description);
  if ((await deps.getExistingHash(data.ticketId)) === hash) return;
  const text = `${t.title}\n${t.description}`.trim();
  if (!text) return;
  const embedding = await deps.embed(settings, text);
  await deps.saveEmbedding({
    ticketId: data.ticketId,
    orgId: data.orgId,
    embedding,
    contentHash: hash,
    model: settings.embeddingModel,
  });
}
