// SPDX-License-Identifier: AGPL-3.0-only

import { and, eq, gte, lt, isNull, notInArray, desc, sql, type SQL } from 'drizzle-orm';
import { tickets, ticketAiTriage, ticketEmbeddings, aiSettings, teamSchemas, teamMembers } from '../schema';
import type { Db } from '../client';
import type { TeamScope } from './records';

const CLOSED_STATUSES = ['resolved', 'closed'];
const SERIES_DAYS = 14;
const FLAGGED_CONFIDENCE = 0.6; // triages below this need a human look
const RECENT_LIMIT = 5;

export interface RecentTriage {
  ticketId: string;
  number: number | null;
  title: string;
  category: string | null;
  priority: string | null;
  confidence: number | null;
  at: string;
}

export interface DashboardStats {
  myOpen: number;
  unassigned: number;
  dueToday: number;
  breaching: number;
  openByStatus: { status: string; count: number }[];
  series: { date: string; created: number; resolved: number }[];
  today: { created: number; resolved: number; triaged: number };
  tess: { enabled: boolean; triaged: number; indexed: number; flagged: number };
  recentTess: RecentTriage[];
}

/** Team-visibility predicate over `tickets` (mirrors records.ts teamScopeCondition). Agents only. */
function teamPredicate(scope?: TeamScope): SQL | null {
  if (!scope || scope.role !== 'agent') return null;
  return sql`(
    NOT EXISTS (SELECT 1 FROM ${teamSchemas} ts WHERE ts.schema_id = ${tickets.schemaId})
    OR ${tickets.schemaId} IN (
      SELECT ts.schema_id FROM ${teamSchemas} ts
      JOIN ${teamMembers} tm ON tm.team_id = ts.team_id
      WHERE tm.user_id = ${scope.userId}
    )
  )`;
}

const dateKey = (d: Date): string => d.toISOString().slice(0, 10);
const iso = (v: unknown): string => (v instanceof Date ? v.toISOString() : String(v));

export function dashboardRepo(db: Db) {
  return {
    /** Aggregate counts, a 14-day series, today's activity, and Tess triage feed — org- and team-scoped. */
    async stats(orgId: string, opts: { userId: string; scope?: TeamScope }): Promise<DashboardStats> {
      const { userId, scope } = opts;
      const team = teamPredicate(scope);
      const teamConds = team ? [team] : [];
      const orgConds = [eq(tickets.orgId, orgId), isNull(tickets.deletedAt), ...teamConds];

      const now = new Date();
      const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      const tomorrowStart = new Date(todayStart.getTime() + 86_400_000);
      const seriesStart = new Date(todayStart.getTime() - (SERIES_DAYS - 1) * 86_400_000);

      const openConds = and(...orgConds, notInArray(tickets.status, CLOSED_STATUSES));

      const [counts] = await db
        .select({
          myOpen: sql<number>`(count(*) filter (where ${tickets.assigneeId} = ${userId}))::int`,
          unassigned: sql<number>`(count(*) filter (where ${tickets.assigneeId} is null))::int`,
          dueToday: sql<number>`(count(*) filter (where ${tickets.dueAt} >= ${todayStart} and ${tickets.dueAt} < ${tomorrowStart}))::int`,
          breaching: sql<number>`(count(*) filter (where ${tickets.slaResolutionDueAt} < ${now} and ${tickets.resolvedAt} is null))::int`,
        })
        .from(tickets)
        .where(openConds);

      const openByStatus = await db
        .select({ status: tickets.status, count: sql<number>`count(*)::int` })
        .from(tickets)
        .where(openConds)
        .groupBy(tickets.status);

      // "Today so far" across all tickets (created/resolved today).
      const [today] = await db
        .select({
          created: sql<number>`(count(*) filter (where ${tickets.createdAt} >= ${todayStart}))::int`,
          resolved: sql<number>`(count(*) filter (where ${tickets.resolvedAt} >= ${todayStart}))::int`,
        })
        .from(tickets)
        .where(and(...orgConds));

      const dayExpr = sql<string>`((${tickets.createdAt} at time zone 'utc')::date)::text`;
      const created = await db
        .select({ d: dayExpr, c: sql<number>`count(*)::int` })
        .from(tickets)
        .where(and(...orgConds, gte(tickets.createdAt, seriesStart)))
        .groupBy(dayExpr);

      const resolvedDayExpr = sql<string>`((${tickets.resolvedAt} at time zone 'utc')::date)::text`;
      const resolved = await db
        .select({ d: resolvedDayExpr, c: sql<number>`count(*)::int` })
        .from(tickets)
        .where(and(...orgConds, gte(tickets.resolvedAt, seriesStart)))
        .groupBy(resolvedDayExpr);

      const createdMap = new Map(created.map((r) => [r.d, r.c]));
      const resolvedMap = new Map(resolved.map((r) => [r.d, r.c]));
      const series = Array.from({ length: SERIES_DAYS }, (_, i) => {
        const key = dateKey(new Date(seriesStart.getTime() + i * 86_400_000));
        return { date: key, created: createdMap.get(key) ?? 0, resolved: resolvedMap.get(key) ?? 0 };
      });

      // Tess activity (triage rows + embeddings).
      const [settings] = await db.select({ enabled: aiSettings.enabled }).from(aiSettings).where(eq(aiSettings.orgId, orgId));
      const [triaged] = await db
        .select({ c: sql<number>`count(*)::int` })
        .from(ticketAiTriage)
        .innerJoin(tickets, eq(tickets.id, ticketAiTriage.ticketId))
        .where(and(...orgConds));
      const [triagedToday] = await db
        .select({ c: sql<number>`count(*)::int` })
        .from(ticketAiTriage)
        .innerJoin(tickets, eq(tickets.id, ticketAiTriage.ticketId))
        .where(and(...orgConds, gte(ticketAiTriage.triagedAt, todayStart)));
      const [flagged] = await db
        .select({ c: sql<number>`count(*)::int` })
        .from(ticketAiTriage)
        .innerJoin(tickets, eq(tickets.id, ticketAiTriage.ticketId))
        .where(and(...orgConds, notInArray(tickets.status, CLOSED_STATUSES), lt(ticketAiTriage.confidence, FLAGGED_CONFIDENCE)));
      const [indexed] = await db
        .select({ c: sql<number>`count(*)::int` })
        .from(ticketEmbeddings)
        .where(eq(ticketEmbeddings.orgId, orgId));

      const recent = await db
        .select({
          ticketId: ticketAiTriage.ticketId,
          number: tickets.number,
          title: sql<string>`coalesce(${tickets.data}->>'title', 'Untitled')`,
          category: ticketAiTriage.category,
          priority: ticketAiTriage.priority,
          confidence: ticketAiTriage.confidence,
          at: ticketAiTriage.triagedAt,
        })
        .from(ticketAiTriage)
        .innerJoin(tickets, eq(tickets.id, ticketAiTriage.ticketId))
        .where(and(...orgConds))
        .orderBy(desc(ticketAiTriage.triagedAt))
        .limit(RECENT_LIMIT);

      return {
        myOpen: counts?.myOpen ?? 0,
        unassigned: counts?.unassigned ?? 0,
        dueToday: counts?.dueToday ?? 0,
        breaching: counts?.breaching ?? 0,
        openByStatus: openByStatus.filter((s): s is { status: string; count: number } => s.status !== null),
        series,
        today: { created: today?.created ?? 0, resolved: today?.resolved ?? 0, triaged: triagedToday?.c ?? 0 },
        tess: { enabled: settings?.enabled ?? false, triaged: triaged?.c ?? 0, indexed: indexed?.c ?? 0, flagged: flagged?.c ?? 0 },
        recentTess: recent.map((r) => ({ ...r, at: iso(r.at) })),
      };
    },
  };
}
