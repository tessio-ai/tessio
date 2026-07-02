// SPDX-License-Identifier: AGPL-3.0-only

import { CronExpressionParser } from 'cron-parser';

export interface ScheduledWorkflow { id: string; cron: string; timezone?: string; lastFiredAt: Date | null; }
export interface DueWorkflow { workflowId: string; firedAt: Date; }

/** Workflows with >=1 cron occurrence in (lastFiredAt, now]. Null lastFiredAt -> not due. */
export function computeDue(workflows: ScheduledWorkflow[], now: Date): DueWorkflow[] {
  const due: DueWorkflow[] = [];
  for (const w of workflows) {
    if (!w.lastFiredAt) continue;
    try {
      const it = CronExpressionParser.parse(w.cron, { currentDate: w.lastFiredAt, endDate: now, tz: w.timezone ?? 'UTC' });
      let fired = false;
      while (true) {
        const next = it.next().toDate(); // throws when past endDate
        if (next > w.lastFiredAt && next <= now) { fired = true; break; }
      }
      if (fired) due.push({ workflowId: w.id, firedAt: now });
    } catch {
      // out of range (no occurrence) or invalid cron — not due
    }
  }
  return due;
}
