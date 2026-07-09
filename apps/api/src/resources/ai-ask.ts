// SPDX-License-Identifier: AGPL-3.0-only

import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Db } from '@tessio/db';
import { ticketsRepo } from '@tessio/db';
import { createTessClient, planQuery, generateAskAnswer } from '@tessio/ai';
import type { FilterNode } from '@tessio/shared';
import { resolveAiSettings } from '../ai/resolve';
import { conflict } from '../errors';
import { runAsk, type AskTicketRow } from '../ai/ask-core';

const askBody = z.object({ query: z.string().min(1).max(500) });
const askResponse = z.object({
  answer: z.string(),
  tickets: z.array(z.object({ number: z.number().nullable(), id: z.string(), title: z.string(), status: z.string().nullable() })),
});

/** Read-only natural-language queue search. Guard with agent/admin roles at registration. */
export function registerAskRoutes(app: FastifyInstance, db: Db): void {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.post('/ai/ask', { schema: { body: askBody, response: { 200: askResponse } } }, async (req) => {
    const settings = await resolveAiSettings(db, req.orgId);
    if (!settings.enabled) throw conflict('Tess AI is not enabled for this org');
    if (!settings.features.ask) throw conflict('Tess ask is not enabled');
    if (!settings.model) throw conflict('Tess AI has no model configured');
    if (!settings.apiKey) throw conflict('Tess AI has no API key configured');

    const model = createTessClient(settings);
    const scope = { userId: req.user.id, role: req.user.role };
    return runAsk(
      {
        plan: (query, now) => planQuery({ model, query, now, botName: settings.botName }),
        queryTickets: async (filter: FilterNode, limit) => {
          const { rows } = await ticketsRepo(db).query(req.orgId, { filter, limit }, scope);
          return rows as unknown as AskTicketRow[];
        },
        answer: (query, tickets) => generateAskAnswer({ model, query, tickets, botName: settings.botName }),
      },
      { query: req.body.query },
    );
  });
}
