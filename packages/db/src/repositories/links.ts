// SPDX-License-Identifier: AGPL-3.0-only

import { and, eq, sql } from 'drizzle-orm';
import { recordLinks } from '../schema';
import type { Db } from '../client';

export type RecordKind = 'ticket' | 'asset' | 'kb_article' | 'form_submission';

export interface NewLink {
  fromType: RecordKind;
  fromId: string;
  toType: RecordKind;
  toId: string;
  relationshipType: string;
  metadata?: Record<string, unknown>;
}

export interface ReachableNode {
  toType: RecordKind;
  toId: string;
  depth: number;
}

export function linksRepo(db: Db) {
  return {
    async createLink(orgId: string, link: NewLink) {
      const rows = await db
        .insert(recordLinks)
        .values({ orgId, ...link, metadata: link.metadata ?? {} })
        .returning();
      return rows[0];
    },

    async deleteLink(orgId: string, id: string): Promise<void> {
      await db.delete(recordLinks).where(and(eq(recordLinks.orgId, orgId), eq(recordLinks.id, id)));
    },

    async listLinks(orgId: string, fromType: RecordKind, fromId: string) {
      return db
        .select()
        .from(recordLinks)
        .where(
          and(eq(recordLinks.orgId, orgId), eq(recordLinks.fromType, fromType), eq(recordLinks.fromId, fromId)),
        );
    },

    /**
     * Walk the edge graph from a starting record along one relationship type,
     * up to maxDepth hops. Depth-limited so cycles terminate (impact analysis,
     * spec 4.5). Returns distinct reachable nodes with their shortest depth.
     */
    async traverse(
      orgId: string,
      fromType: RecordKind,
      fromId: string,
      relationshipType: string,
      maxDepth: number,
    ): Promise<ReachableNode[]> {
      const result = await db.execute(sql`
        WITH RECURSIVE graph AS (
          SELECT to_type, to_id, 1 AS depth
          FROM record_links
          WHERE org_id = ${orgId} AND from_type = ${fromType} AND from_id = ${fromId}
            AND relationship_type = ${relationshipType}
          UNION ALL
          SELECT rl.to_type, rl.to_id, g.depth + 1
          FROM record_links rl
          JOIN graph g ON rl.from_type = g.to_type AND rl.from_id = g.to_id
          WHERE rl.org_id = ${orgId} AND rl.relationship_type = ${relationshipType}
            AND g.depth < ${maxDepth}
        )
        SELECT to_type, to_id, MIN(depth) AS depth
        FROM graph
        GROUP BY to_type, to_id
        ORDER BY depth
      `);
      return (result.rows as Array<{ to_type: RecordKind; to_id: string; depth: number | string }>).map((r) => ({
        toType: r.to_type,
        toId: r.to_id,
        depth: Number(r.depth),
      }));
    },
  };
}
