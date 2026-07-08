// SPDX-License-Identifier: AGPL-3.0-only

import { and, eq, gte, lt, isNull, sql, type SQL } from 'drizzle-orm';
import { tickets, ticketAiTriage, csatResponses, teamSchemas, teamMembers } from '../schema';
import { compileFilter, resolveFieldExpr } from './compile-filter';
import type { ReportDefinition } from '@tessio/shared';
import type { Db } from '../client';

export interface ReportScope {
  userId: string;
  role: 'admin' | 'agent' | 'requester';
}

export interface ReportRow {
  key: string | null;
  value: number;
}

export interface ReportResult {
  rows: ReportRow[];
}

const FLAGGED = 0.6;

/**
 * Team-visibility predicate over `tickets` (copied verbatim from dashboard.ts).
 * Agents are limited to tickets whose schemaId is unscoped OR belongs to one
 * of their teams (via team_schemas/team_members). Admins and requesters see all.
 */
function teamPredicate(scope: ReportScope): SQL | null {
  if (scope.role !== 'agent') return null;
  return sql`(
    NOT EXISTS (SELECT 1 FROM ${teamSchemas} ts WHERE ts.schema_id = ${tickets.schemaId})
    OR ${tickets.schemaId} IN (
      SELECT ts.schema_id FROM ${teamSchemas} ts
      JOIN ${teamMembers} tm ON tm.team_id = ts.team_id
      WHERE tm.user_id = ${scope.userId}
    )
  )`;
}

const VALID_FNS = new Set(['avg', 'sum', 'min', 'max']);

/**
 * Translate a measure id into an aggregate SQL expression.
 * All results are cast to float8 so Drizzle always returns a JS number.
 */
function measureExpr(def: ReportDefinition): SQL {
  const id = def.measure.id;
  switch (id) {
    case 'count':
      return sql`count(*)::float8`;
    case 'count_distinct_requesters':
      return sql`count(distinct ${tickets.requesterId})::float8`;
    case 'avg_resolution_hours':
      return sql`coalesce(avg(extract(epoch from (${tickets.resolvedAt} - ${tickets.createdAt}))/3600.0) filter (where ${tickets.resolvedAt} is not null), 0)::float8`;
    case 'med_resolution_hours':
      return sql`coalesce(percentile_cont(0.5) within group (order by extract(epoch from (${tickets.resolvedAt} - ${tickets.createdAt}))/3600.0) filter (where ${tickets.resolvedAt} is not null), 0)::float8`;
    case 'max_resolution_hours':
      return sql`coalesce(max(extract(epoch from (${tickets.resolvedAt} - ${tickets.createdAt}))/3600.0) filter (where ${tickets.resolvedAt} is not null), 0)::float8`;
    case 'avg_age_hours':
      return sql`coalesce(avg(extract(epoch from (now() - ${tickets.createdAt}))/3600.0), 0)::float8`;
    case 'avg_ai_confidence':
      return sql`coalesce(avg(${ticketAiTriage.confidence}), 0)::float8`;
    case 'min_ai_confidence':
      return sql`coalesce(min(${ticketAiTriage.confidence}), 0)::float8`;
    case 'count_triaged':
      return sql`count(${ticketAiTriage.ticketId})::float8`;
    case 'count_flagged':
      return sql`count(*) filter (where ${ticketAiTriage.confidence} < ${FLAGGED})::float8`;
    case 'pct_triaged':
      return sql`(100.0 * count(${ticketAiTriage.ticketId}) / nullif(count(*), 0))::float8`;
    case 'avg_csat':
      return sql`coalesce(avg(${csatResponses.rating}), 0)::float8`;
    case 'count_csat_responses':
      return sql`count(${csatResponses.rating})::float8`;
    case 'pct_csat_responded':
      // answered surveys over surveys sent (not over all tickets)
      return sql`(100.0 * count(${csatResponses.rating}) / nullif(count(${csatResponses.id}), 0))::float8`;
    default: {
      if (/^data\.[a-zA-Z0-9_]+$/.test(id) && def.measure.fn) {
        const fn = def.measure.fn; // 'avg' | 'sum' | 'min' | 'max' (zod-enum — safe to raw)
        if (!VALID_FNS.has(fn)) throw new Error(`Unknown measure fn: ${fn}`);
        const expr = resolveFieldExpr(tickets, id, 'number');
        return sql`coalesce(${sql.raw(fn)}(${expr}), 0)::float8`;
      }
      throw new Error(`Unknown measure: ${id}`);
    }
  }
}

/**
 * Translate a dimension field + optional date bucket into a grouping SQL expression.
 * Date dimensions are formatted as 'YYYY-MM-DD' ISO strings.
 */
function dimensionExpr(field: string, bucket?: 'day' | 'week' | 'month'): SQL {
  const b = bucket ?? 'day';
  switch (field) {
    case 'status':
      return sql`${tickets.status}`;
    case 'priority':
      return sql`${tickets.priority}`;
    case 'assigneeId':
      return sql`${tickets.assigneeId}::text`;
    case 'teamId':
      return sql`${tickets.teamId}::text`;
    case 'schemaId':
      return sql`${tickets.schemaId}::text`;
    case 'requesterId':
      return sql`${tickets.requesterId}::text`;
    case 'ai.category':
      return sql`${ticketAiTriage.category}`;
    case 'ai.priority':
      return sql`${ticketAiTriage.priority}`;
    case 'csat.rating':
      return sql`${csatResponses.rating}::text`;
    case 'createdAt':
      return sql`to_char(date_trunc(${b}, ${tickets.createdAt}), 'YYYY-MM-DD')`;
    case 'resolvedAt':
      return sql`to_char(date_trunc(${b}, ${tickets.resolvedAt}), 'YYYY-MM-DD')`;
    default:
      if (/^data\.[a-zA-Z0-9_]+$/.test(field)) {
        return resolveFieldExpr(tickets, field, 'text');
      }
      throw new Error(`Unknown dimension: ${field}`);
  }
}

/**
 * Derive date range WHERE conditions from the definition's dateRange.
 * Preset shortcuts are expanded relative to now (UTC). Explicit from/to strings
 * are treated as ISO timestamps. 'all'/absent produces no conditions.
 */
function dateRangeConds(def: ReportDefinition): SQL[] {
  const dr = def.dateRange;
  if (!dr) return [];

  const col = dr.field === 'resolvedAt' ? tickets.resolvedAt : tickets.createdAt;

  // No preset (or preset === 'all'): use explicit from/to if provided, otherwise no date bounds.
  if (!dr.preset || dr.preset === 'all') {
    const conds: SQL[] = [];
    if (dr.from) conds.push(gte(col, new Date(dr.from)));
    if (dr.to) conds.push(lt(col, new Date(dr.to)));
    return conds;
  }

  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  let from: Date;

  switch (dr.preset) {
    case '7d':
      from = new Date(todayUTC.getTime() - 7 * 86_400_000);
      break;
    case '30d':
      from = new Date(todayUTC.getTime() - 30 * 86_400_000);
      break;
    case '90d':
      from = new Date(todayUTC.getTime() - 90 * 86_400_000);
      break;
    case '12mo':
      from = new Date(Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), now.getUTCDate()));
      break;
    case 'mtd':
      from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      break;
    case 'ytd':
      from = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
      break;
    default:
      return [];
  }

  // Explicit dr.from/dr.to each independently override the corresponding preset-computed bound.
  const effectiveFrom = dr.from ? new Date(dr.from) : from;
  const conds: SQL[] = [gte(col, effectiveFrom)];
  if (dr.to) conds.push(lt(col, new Date(dr.to)));
  return conds;
}

/**
 * Execute a ReportDefinition against the database, applying org/team scoping,
 * date-range filtering, and the filter AST. Returns grouped rows ordered by
 * value descending (or date ascending for date dimensions).
 */
export async function runReport(
  db: Db,
  orgId: string,
  def: ReportDefinition,
  scope: ReportScope,
): Promise<ReportResult> {
  const conds: SQL[] = [eq(tickets.orgId, orgId), isNull(tickets.deletedAt)];

  const team = teamPredicate(scope);
  if (team) conds.push(team);

  conds.push(...dateRangeConds(def));

  // resolvedAt is nullable; a null group-by key would be a misleading "unresolved" bucket.
  if (def.groupBy?.field === 'resolvedAt') conds.push(sql`${tickets.resolvedAt} is not null`);

  if (def.filter) {
    conds.push(compileFilter(tickets, def.filter));
  }

  const where = and(...conds);
  const value = measureExpr(def);

  if (!def.groupBy) {
    const [row] = await db
      .select({ value })
      .from(tickets)
      .leftJoin(ticketAiTriage, eq(ticketAiTriage.ticketId, tickets.id))
      .leftJoin(csatResponses, eq(csatResponses.ticketId, tickets.id))
      .where(where);
    return { rows: [{ key: null, value: Number(row?.value ?? 0) }] };
  }

  const { field, dateBucket, limit } = def.groupBy;
  const dim = dimensionExpr(field, dateBucket);
  const isDateDim = field === 'createdAt' || field === 'resolvedAt';

  const rows = await db
    .select({ key: sql<string | null>`${dim}`, value })
    .from(tickets)
    .leftJoin(ticketAiTriage, eq(ticketAiTriage.ticketId, tickets.id))
    .leftJoin(csatResponses, eq(csatResponses.ticketId, tickets.id))
    .where(where)
    // Positional GROUP BY/ORDER BY: the dimension is select column 1, the measure column 2.
    // We must NOT use .groupBy(dim) here — Drizzle emits the bare column (not the
    // to_char(date_trunc(...)) wrapper), which Postgres rejects ("must appear in GROUP BY").
    .groupBy(sql`1`)
    .orderBy(isDateDim ? sql`1 asc` : sql`2 desc`)
    .limit(limit ?? 20);

  return {
    rows: rows.map((r) => ({ key: r.key, value: Number(r.value ?? 0) })),
  };
}
