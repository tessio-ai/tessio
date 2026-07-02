// SPDX-License-Identifier: AGPL-3.0-only

import { CronExpressionParser } from 'cron-parser';

export interface CronPreset {
  label: string;
  cron: string;
}

export const CRON_PRESETS: CronPreset[] = [
  { label: 'Every hour', cron: '0 * * * *' },
  { label: 'Every day at 9am', cron: '0 9 * * *' },
  { label: 'Every weekday at 9am', cron: '0 9 * * 1-5' },
  { label: 'Every Monday at 9am', cron: '0 9 * * 1' },
];

/** Next `n` occurrences of `cron` in `tz`; `[]` if the expression is invalid. */
export function nextRuns(cron: string, tz = 'UTC', n = 3): Date[] {
  try {
    const it = CronExpressionParser.parse(cron, { tz });
    const out: Date[] = [];
    for (let i = 0; i < n; i++) out.push(it.next().toDate());
    return out;
  } catch {
    return [];
  }
}
