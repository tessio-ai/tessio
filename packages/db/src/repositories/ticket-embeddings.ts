// SPDX-License-Identifier: AGPL-3.0-only

import { and, eq, sql } from 'drizzle-orm';
import { ticketEmbeddings, tickets, teamSchemas, teamMembers } from '../schema';
import type { Db } from '../client';
import type { TeamScope } from './records';

export interface EmbeddingUpsert {
  ticketId: string;
  orgId: string;
  embedding: number[];
  contentHash: string;
  model: string;
}

export interface SimilarTicket {
  id: string;
  number: number | null;
  title: string | null;
  status: string | null;
  assigneeId: string | null;
  score: number;
}

const toVectorLiteral = (v: number[]): string => `[${v.join(',')}]`;

export function ticketEmbeddingsRepo(db: Db) {
  return {
    async get(ticketId: string) {
      const rows = await db.select().from(ticketEmbeddings).where(eq(ticketEmbeddings.ticketId, ticketId));
      return rows[0];
    },

    async upsert(input: EmbeddingUpsert) {
      await db
        .insert(ticketEmbeddings)
        .values({ ...input, embeddedAt: new Date() })
        .onConflictDoUpdate({
          target: ticketEmbeddings.ticketId,
          set: {
            orgId: input.orgId,
            embedding: input.embedding,
            contentHash: input.contentHash,
            model: input.model,
            embeddedAt: new Date(),
          },
        });
    },

    /** ticketIds in this org that have no current embedding for the given content hash (backfill). */
    async listStale(orgId: string, limit = 200): Promise<{ id: string; title: string; description: string; hash: string }[]> {
      const rows = await db.execute<{ id: string; title: string; description: string; hash: string }>(sql`
        SELECT t.id,
               coalesce(t.data->>'title','') AS title,
               coalesce(t.data->>'description','') AS description,
               encode(digest(coalesce(t.data->>'title','') || E'\n' || coalesce(t.data->>'description',''), 'sha256'),'hex') AS hash
        FROM ${tickets} t
        LEFT JOIN ${ticketEmbeddings} e ON e.ticket_id = t.id
        WHERE t.org_id = ${orgId} AND t.deleted_at IS NULL
          AND (e.ticket_id IS NULL OR e.content_hash <> encode(digest(coalesce(t.data->>'title','') || E'\n' || coalesce(t.data->>'description',''), 'sha256'),'hex'))
        LIMIT ${limit}
      `);
      return rows.rows as { id: string; title: string; description: string; hash: string }[];
    },

    /** Nearest neighbours to the source ticket's stored embedding, org- and team-scoped. */
    async findSimilar(
      orgId: string,
      ticketId: string,
      opts: { limit?: number; scope?: TeamScope } = {},
    ): Promise<SimilarTicket[]> {
      const src = await db
        .select({ embedding: ticketEmbeddings.embedding })
        .from(ticketEmbeddings)
        .where(and(eq(ticketEmbeddings.orgId, orgId), eq(ticketEmbeddings.ticketId, ticketId)));
      if (!src[0]) return [];
      const vec = toVectorLiteral(src[0].embedding as number[]);
      const limit = opts.limit ?? 5;

      // Team-visibility predicate (mirrors records.ts teamScopeCondition); admins/requesters unrestricted here.
      const teamPredicate =
        opts.scope && opts.scope.role === 'agent'
          ? sql`AND (
              NOT EXISTS (SELECT 1 FROM ${teamSchemas} ts WHERE ts.schema_id = t.schema_id)
              OR t.schema_id IN (
                SELECT ts.schema_id FROM ${teamSchemas} ts
                JOIN ${teamMembers} tm ON tm.team_id = ts.team_id
                WHERE tm.user_id = ${opts.scope.userId}
              )
            )`
          : sql``;

      const result = await db.execute(sql`
        WITH ranked AS (
          SELECT t.id,
                 t.number,
                 t.data->>'title' AS title,
                 t.status,
                 t.assignee_id AS "assigneeId",
                 1 - (e.embedding <=> ${vec}::vector) AS score
          FROM ${ticketEmbeddings} e
          JOIN ${tickets} t ON t.id = e.ticket_id
          WHERE e.org_id = ${orgId}
            AND e.ticket_id <> ${ticketId}
            AND t.deleted_at IS NULL
            ${teamPredicate}
          ORDER BY e.embedding <=> ${vec}::vector
          LIMIT ${limit}
        )
        SELECT * FROM ranked WHERE score >= 0.3
      `);
      return result.rows as unknown as SimilarTicket[];
    },
  };
}
