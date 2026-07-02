// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod';
export const slaTargetsSchema = z.record(z.object({
  responseMins: z.number().int().positive(),
  resolutionMins: z.number().int().positive(),
}));
export type SlaTargets = z.infer<typeof slaTargetsSchema>;
export function computeSlaTargets(createdAt: Date, priority: string | null, targets: SlaTargets):
  { responseDueAt: Date; resolutionDueAt: Date } | null {
  if (!priority) return null;
  const t = targets[priority];
  if (!t) return null;
  return {
    responseDueAt: new Date(createdAt.getTime() + t.responseMins * 60_000),
    resolutionDueAt: new Date(createdAt.getTime() + t.resolutionMins * 60_000),
  };
}
export const SLA_TICK_QUEUE = 'sla-tick';
