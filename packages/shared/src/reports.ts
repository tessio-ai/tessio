// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod';
import { filterNode } from './filter';

export const reportDimensionKind = z.enum(['status', 'priority', 'user', 'team', 'schema', 'string', 'date']);
export type ReportDimensionKind = z.infer<typeof reportDimensionKind>;

export const reportDefinition = z.object({
  source: z.literal('tickets'),
  measure: z.object({ id: z.string().min(1), field: z.string().optional(), fn: z.enum(['avg', 'sum', 'min', 'max']).optional() }),
  groupBy: z
    .object({
      field: z.string().min(1),
      dateBucket: z.enum(['day', 'week', 'month']).optional(),
      limit: z.number().int().positive().max(50).optional(),
    })
    .optional(),
  filter: filterNode.optional(),
  dateRange: z
    .object({
      field: z.enum(['createdAt', 'resolvedAt']).default('createdAt'),
      preset: z.enum(['7d', '30d', '90d', '12mo', 'mtd', 'ytd', 'all']).optional(),
      from: z.string().optional(),
      to: z.string().optional(),
    })
    .optional(),
  visualization: z.enum(['number', 'table', 'bar', 'line', 'pie']).default('table'),
});
export type ReportDefinition = z.infer<typeof reportDefinition>;

export interface ReportMeasure { id: string; label: string; fn: 'count' | 'avg' | 'sum' | 'min' | 'max' | 'pct' | 'median'; group?: 'tickets' | 'ai' | 'csat' | 'custom'; }
export const REPORT_MEASURES: ReportMeasure[] = [
  { id: 'count', label: 'Ticket count', fn: 'count', group: 'tickets' },
  { id: 'count_distinct_requesters', label: 'Unique requesters', fn: 'count', group: 'tickets' },
  { id: 'avg_resolution_hours', label: 'Avg resolution time (h)', fn: 'avg', group: 'tickets' },
  { id: 'med_resolution_hours', label: 'Median resolution time (h)', fn: 'median', group: 'tickets' },
  { id: 'max_resolution_hours', label: 'Max resolution time (h)', fn: 'max', group: 'tickets' },
  { id: 'avg_age_hours', label: 'Avg ticket age (h)', fn: 'avg', group: 'tickets' },
  { id: 'avg_ai_confidence', label: 'Avg AI confidence', fn: 'avg', group: 'ai' },
  { id: 'min_ai_confidence', label: 'Min AI confidence', fn: 'min', group: 'ai' },
  { id: 'count_triaged', label: 'AI-triaged count', fn: 'count', group: 'ai' },
  { id: 'count_flagged', label: 'AI low-confidence count', fn: 'count', group: 'ai' },
  { id: 'pct_triaged', label: 'AI-triaged %', fn: 'pct', group: 'ai' },
  { id: 'avg_csat', label: 'Avg satisfaction (1–5)', fn: 'avg', group: 'csat' },
  { id: 'count_csat_responses', label: 'Satisfaction responses', fn: 'count', group: 'csat' },
  { id: 'pct_csat_responded', label: 'Satisfaction response rate %', fn: 'pct', group: 'csat' },
];

export interface ReportDimension { id: string; label: string; kind: ReportDimensionKind; }
export const REPORT_DIMENSIONS: ReportDimension[] = [
  { id: 'status', label: 'Status', kind: 'status' },
  { id: 'priority', label: 'Priority', kind: 'priority' },
  { id: 'assigneeId', label: 'Assignee', kind: 'user' },
  { id: 'teamId', label: 'Team', kind: 'team' },
  { id: 'schemaId', label: 'Ticket type', kind: 'schema' },
  { id: 'requesterId', label: 'Requester', kind: 'user' },
  { id: 'ai.category', label: 'AI category', kind: 'string' },
  { id: 'ai.priority', label: 'AI priority', kind: 'priority' },
  { id: 'csat.rating', label: 'Satisfaction rating', kind: 'string' },
  { id: 'createdAt', label: 'Created date', kind: 'date' },
  { id: 'resolvedAt', label: 'Resolved date', kind: 'date' },
];

export const findMeasure = (id: string): ReportMeasure | undefined => REPORT_MEASURES.find((m) => m.id === id);
export const findDimension = (id: string): ReportDimension | undefined => REPORT_DIMENSIONS.find((d) => d.id === id);
/** A `data.<key>` custom-field id (numeric measure or string dimension). */
export const isDataField = (id: string): boolean => /^data\.[a-zA-Z0-9_]+$/.test(id);
