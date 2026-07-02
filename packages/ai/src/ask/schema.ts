// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod';

/** Operators the model may use (mirrors @tessio/shared comparisonOp). */
export const askOp = z.enum(['eq', 'ne', 'lt', 'lte', 'gt', 'gte', 'in', 'contains', 'startsWith', 'isNull']);

/**
 * One flat condition. `value` is always a string array (structured-output-friendly):
 * scalar ops use value[0]; `in` uses the whole array; `isNull` ignores it.
 * `field` is a ticket column property, `data.<key>`, or the pseudo-field `unassigned`.
 */
export const askLeaf = z.object({
  field: z.string(),
  op: askOp,
  value: z.array(z.string()),
});
export type AskLeaf = z.infer<typeof askLeaf>;

/** Flat (non-recursive) query plan emitted by the model. */
export const askPlanSchema = z.object({
  answerable: z.boolean(),
  combine: z.enum(['and', 'or']),
  conditions: z.array(askLeaf),
  limit: z.number(),
  title: z.string(),
});
export type AskPlan = z.infer<typeof askPlanSchema>;
