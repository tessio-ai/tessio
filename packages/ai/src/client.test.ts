// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { createTessClient, createTessEmbeddingModel } from './client';
import type { AiSettings } from './settings';

const base: AiSettings = {
  enabled: true,
  provider: 'openai',
  baseUrl: null,
  model: 'gpt-4o-mini',
  embeddingModel: 'text-embedding-3-small',
  apiKey: 'sk-test',
  features: { summary: true, draft: true, triage: true, similar: true, ask: false },
};

describe('createTessClient', () => {
  it('returns a chat model handle when a key is set', () => {
    expect(createTessClient(base)).toBeTruthy();
  });

  it('builds an openai-compatible client with a custom base URL', () => {
    expect(createTessClient({ ...base, provider: 'openai-compatible', baseUrl: 'http://localhost:11434/v1' })).toBeTruthy();
    expect(createTessEmbeddingModel({ ...base, provider: 'openai-compatible', baseUrl: 'http://localhost:11434/v1' })).toBeTruthy();
  });

  it('throws when there is no API key', () => {
    expect(() => createTessClient({ ...base, apiKey: null })).toThrow(/API key/);
  });
});
