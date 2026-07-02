// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { MockLanguageModelV3 } from 'ai/test';
import type { LanguageModel } from 'ai';
import { generateAskAnswer } from './ask/answer';

/**
 * Boundary test: proves the PII guardrail actually scrubs text on the way to the
 * model, not just in isolation. We capture the exact prompt the model receives.
 */
describe('PII guardrail at the model boundary', () => {
  it('redacts PII in the prompt that reaches the model (Ask Tess)', async () => {
    let captured = '';
    // The mock is runtime-correct; assert its config against the constructor's own
    // param type so we don't depend on the SDK's churny internal result type.
    const mock = new MockLanguageModelV3({
      doGenerate: async (opts: { prompt: unknown }) => {
        captured = JSON.stringify(opts.prompt);
        return {
          content: [{ type: 'text', text: 'ok' }],
          finishReason: 'stop',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          warnings: [],
        };
      },
    } as unknown as ConstructorParameters<typeof MockLanguageModelV3>[0]);

    await generateAskAnswer({
      model: mock as unknown as LanguageModel,
      query: 'reset for john@acme.com / 555-123-4567',
      tickets: [
        { number: 1, title: 'call 555-987-6543', status: 'open', priority: 'high', assigned: false, dueAt: null, category: null },
      ],
    });

    // Raw PII must never appear in what the model received…
    expect(captured).not.toContain('john@acme.com');
    expect(captured).not.toContain('555-123-4567');
    expect(captured).not.toContain('555-987-6543');
    // …and the placeholders must.
    expect(captured).toContain('[REDACTED_EMAIL]');
    expect(captured).toContain('[REDACTED_PHONE]');
  });
});
