// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, vi } from 'vitest';
import { processTriageJob, type TriageDeps } from './triage';

function deps(overrides: Partial<TriageDeps> = {}): TriageDeps {
  return {
    loadSettings: vi.fn().mockResolvedValue({
      enabled: true,
      model: 'gpt-4o-mini',
      embeddingModel: 'text-embedding-3-small',
      apiKey: 'sk',
      features: { summary: true, draft: true, triage: true, similar: false },
    }),
    loadTicket: vi.fn().mockResolvedValue({ number: 1, title: 'T', description: 'd', category: 'Hardware' }),
    loadCandidates: vi.fn().mockResolvedValue([{ id: 'u1', name: 'Priya' }]),
    runTriage: vi.fn().mockResolvedValue({
      category: 'Hardware',
      priority: 'high',
      suggestedAssigneeId: 'u1',
      confidence: 0.9,
      reasoning: 'r',
    }),
    saveTriage: vi.fn().mockResolvedValue(undefined),
    recordTriaged: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('processTriageJob', () => {
  it('saves triage and records an activity event', async () => {
    const d = deps();
    await processTriageJob({ orgId: 'o1', ticketId: 't1' }, d);
    expect(d.saveTriage).toHaveBeenCalledWith(
      expect.objectContaining({ ticketId: 't1', category: 'Hardware', priority: 'high', suggestedAssigneeId: 'u1' }),
    );
    expect(d.recordTriaged).toHaveBeenCalledWith('o1', 't1');
  });

  it('no-ops when triage is disabled', async () => {
    const d = deps({
      loadSettings: vi.fn().mockResolvedValue({
        enabled: true,
        model: 'm',
        embeddingModel: 'text-embedding-3-small',
        apiKey: 'sk',
        features: { summary: true, draft: true, triage: false, similar: false },
      }),
    });
    await processTriageJob({ orgId: 'o1', ticketId: 't1' }, d);
    expect(d.runTriage).not.toHaveBeenCalled();
    expect(d.saveTriage).not.toHaveBeenCalled();
    expect(d.recordTriaged).not.toHaveBeenCalled();
  });

  it('no-ops when AI is disabled (enabled: false)', async () => {
    const d = deps({
      loadSettings: vi.fn().mockResolvedValue({
        enabled: false,
        model: 'm',
        embeddingModel: 'text-embedding-3-small',
        apiKey: 'sk',
        features: { summary: true, draft: true, triage: true, similar: false },
      }),
    });
    await processTriageJob({ orgId: 'o1', ticketId: 't1' }, d);
    expect(d.runTriage).not.toHaveBeenCalled();
    expect(d.saveTriage).not.toHaveBeenCalled();
    expect(d.recordTriaged).not.toHaveBeenCalled();
  });
});
