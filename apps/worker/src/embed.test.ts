// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, vi } from 'vitest';
import { processEmbedJob, type EmbedDeps } from './embed';

function deps(overrides: Partial<EmbedDeps> = {}): EmbedDeps {
  return {
    loadSettings: vi.fn().mockResolvedValue({
      enabled: true,
      model: 'gpt-4o-mini',
      embeddingModel: 'text-embedding-3-small',
      apiKey: 'sk',
      features: { summary: false, draft: false, triage: false, similar: true },
    }),
    loadTicketText: vi.fn().mockResolvedValue({ title: 'Printer', description: 'offline' }),
    getExistingHash: vi.fn().mockResolvedValue(null),
    embed: vi.fn().mockResolvedValue(new Array(1536).fill(0)),
    saveEmbedding: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('processEmbedJob', () => {
  it('embeds and saves on a new ticket', async () => {
    const { contentHash } = await import('@tessio/ai');
    const d = deps();
    await processEmbedJob({ orgId: 'o1', ticketId: 't1' }, d);
    expect(d.embed).toHaveBeenCalledWith(expect.anything(), 'Printer\noffline');
    expect(d.saveEmbedding).toHaveBeenCalledWith({
      ticketId: 't1',
      orgId: 'o1',
      embedding: expect.any(Array),
      contentHash: contentHash('Printer', 'offline'),
      model: 'text-embedding-3-small',
    });
  });

  it('no-ops when the content hash is unchanged', async () => {
    // contentHash('Printer','offline') is deterministic; precompute by calling the real fn via embed.ts export path
    const { contentHash } = await import('@tessio/ai');
    const d = deps({ getExistingHash: vi.fn().mockResolvedValue(contentHash('Printer', 'offline')) });
    await processEmbedJob({ orgId: 'o1', ticketId: 't1' }, d);
    expect(d.embed).not.toHaveBeenCalled();
    expect(d.saveEmbedding).not.toHaveBeenCalled();
  });

  it('no-ops when similar is disabled', async () => {
    const d = deps({
      loadSettings: vi.fn().mockResolvedValue({
        enabled: true, model: 'm', embeddingModel: 'e', apiKey: 'sk',
        features: { summary: false, draft: false, triage: false, similar: false },
      }),
    });
    await processEmbedJob({ orgId: 'o1', ticketId: 't1' }, d);
    expect(d.embed).not.toHaveBeenCalled();
    expect(d.saveEmbedding).not.toHaveBeenCalled();
  });

  it('no-ops when AI is disabled (enabled: false)', async () => {
    const d = deps({
      loadSettings: vi.fn().mockResolvedValue({
        enabled: false, model: 'm', embeddingModel: 'e', apiKey: 'sk',
        features: { summary: false, draft: false, triage: false, similar: true },
      }),
    });
    await processEmbedJob({ orgId: 'o1', ticketId: 't1' }, d);
    expect(d.embed).not.toHaveBeenCalled();
    expect(d.saveEmbedding).not.toHaveBeenCalled();
  });

  it('no-ops when no API key', async () => {
    const d = deps({
      loadSettings: vi.fn().mockResolvedValue({
        enabled: true, model: 'm', embeddingModel: 'e', apiKey: null,
        features: { summary: false, draft: false, triage: false, similar: true },
      }),
    });
    await processEmbedJob({ orgId: 'o1', ticketId: 't1' }, d);
    expect(d.embed).not.toHaveBeenCalled();
    expect(d.saveEmbedding).not.toHaveBeenCalled();
  });
});
