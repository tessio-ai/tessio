// SPDX-License-Identifier: AGPL-3.0-only

import { pgTable, uuid, text, timestamp, index, vector } from 'drizzle-orm/pg-core';
import { tickets } from './tickets';
import { orgs } from './orgs';

/** One row per embedded ticket (Tess "similar tickets"). */
export const ticketEmbeddings = pgTable(
  'ticket_embeddings',
  {
    ticketId: uuid('ticket_id').primaryKey().references(() => tickets.id, { onDelete: 'cascade' }),
    orgId: uuid('org_id').notNull().references(() => orgs.id),
    embedding: vector('embedding', { dimensions: 1536 }).notNull(),
    contentHash: text('content_hash').notNull(),
    model: text('model').notNull(),
    embeddedAt: timestamp('embedded_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('ticket_embeddings_org_idx').on(t.orgId),
    index('ticket_embeddings_hnsw_idx').using('hnsw', t.embedding.op('vector_cosine_ops')),
  ],
);
