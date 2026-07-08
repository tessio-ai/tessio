// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod';

// ── Satisfaction (CSAT) surveys ──────────────────────────────────────────────
export const CSAT_MIN_RATING = 1;
export const CSAT_MAX_RATING = 5;

export const DEFAULT_CSAT_QUESTION = 'How satisfied were you with the resolution of your request?';

/** Statuses whose entry triggers a satisfaction survey for the requester. */
export const CSAT_TRIGGER_STATUSES = new Set(['resolved', 'closed']);

export const csatSettingsInput = z.object({
  enabled: z.boolean().optional(),
  question: z.string().trim().max(300).optional(),
});
export type CsatSettingsInput = z.infer<typeof csatSettingsInput>;

export const csatRating = z.number().int().min(CSAT_MIN_RATING).max(CSAT_MAX_RATING);

export const csatSubmitBody = z.object({
  rating: csatRating,
  comment: z.string().trim().max(2000).optional(),
});
export type CsatSubmitBody = z.infer<typeof csatSubmitBody>;
