// SPDX-License-Identifier: AGPL-3.0-only

import { generateObject, type LanguageModel } from 'ai';
import { z } from 'zod';

export { aiFeatures, createTessClient, encryptSecret } from '@tessio/ai';

/** One tiny structured call to prove the key + endpoint work. */
export async function generateObjectProbe(model: LanguageModel): Promise<void> {
  await generateObject({
    model,
    schema: z.object({ ok: z.boolean() }),
    prompt: 'Reply with {"ok": true}.',
  });
}
