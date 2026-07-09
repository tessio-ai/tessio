// SPDX-License-Identifier: AGPL-3.0-only

import { streamText, type LanguageModel } from 'ai';
import { buildKbDraftPrompt, type KbDraftContext } from '../prompts/kb-draft';

/**
 * Stream a knowledge-base article draft ("Draft with Tess"). Unlike ticket
 * drafting, the inputs here are author-provided help content (title, topic, and
 * the article-in-progress), not requester PII — so there is no redaction step.
 */
export function streamKbDraft(input: { model: LanguageModel; article: KbDraftContext; botName?: string }) {
  const { system, prompt } = buildKbDraftPrompt({ article: input.article, botName: input.botName });
  return streamText({ model: input.model, system, prompt });
}
