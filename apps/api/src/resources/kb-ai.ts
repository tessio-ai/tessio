// SPDX-License-Identifier: AGPL-3.0-only

import type { FastifyInstance, FastifyReply } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Db } from '@tessio/db';
import { createTessClient, streamKbDraft, type AiSettings } from '@tessio/ai';
import { resolveAiSettings } from '../ai/resolve';
import { conflict } from '../errors';

const draftBody = z.object({
  title: z.string().max(300).optional(),
  category: z.string().max(200).optional(),
  categoryGroup: z.string().max(50).optional(),
  existingHtml: z.string().max(50_000).optional(),
});

/** "Draft with Tess" reuses the reply-drafting feature flag — both are text generation. */
function assertDraftEnabled(settings: AiSettings): void {
  if (!settings.enabled) throw conflict('Tess AI is not enabled for this org');
  if (!settings.features.draft) throw conflict('Tess draft is not enabled');
  if (!settings.model) throw conflict('Tess AI has no model configured');
}

async function streamToReply(reply: FastifyReply, textStream: AsyncIterable<string>): Promise<void> {
  reply.hijack();
  reply.raw.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
  try {
    for await (const delta of textStream) reply.raw.write(delta);
  } catch (err) {
    reply.raw.write(`\n[error: ${(err as Error).message}]`);
  } finally {
    reply.raw.end();
  }
}

/** Knowledge-base authoring assistance ("Draft with Tess"). Guard with agent/admin at registration. */
export function registerKbAiRoutes(app: FastifyInstance, db: Db): void {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.post('/kb-articles/ai/draft', { schema: { body: draftBody } }, async (req, reply) => {
    const settings = await resolveAiSettings(db, req.orgId);
    assertDraftEnabled(settings);
    const body = req.body as z.infer<typeof draftBody>;
    const result = streamKbDraft({
      model: createTessClient(settings),
      article: {
        title: body.title ?? '',
        category: body.category ?? null,
        categoryGroup: body.categoryGroup ?? null,
        existingHtml: body.existingHtml ?? null,
      },
      botName: settings.botName,
    });
    await streamToReply(reply, result.textStream);
  });
}
