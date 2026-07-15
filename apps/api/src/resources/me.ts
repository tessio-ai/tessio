// SPDX-License-Identifier: AGPL-3.0-only

import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Db } from '@tessio/db';
import { usersRepo } from '@tessio/db';
import { notificationPrefsSchema } from '@tessio/shared';
import { getEntitlements } from '@tessio/entitlements';
import { ApiError } from '../errors';

const entitlementsResponse = z.object({
  edition: z.enum(['community', 'enterprise', 'cloud']),
  features: z.record(z.boolean()),
  /** Max active billable seats (admins + agents). null = unlimited (site license). */
  seatLimit: z.number().nullable(),
  /** Active admins + agents currently occupying seats in this org. */
  seatsUsed: z.number(),
});

/** Any authenticated user — per-user notification preferences + entitlements. */
export function registerMeRoutes(app: FastifyInstance, db: Db): void {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const repo = usersRepo(db);

  // Edition + per-feature entitlements + seat usage, so the web console can
  // gate enterprise UI and show "X of Y seats used".
  r.get('/me/entitlements', { schema: { response: { 200: entitlementsResponse } } }, async (req) => {
    const seatsUsed = await repo.countBillable(req.orgId);
    return { ...getEntitlements(), seatsUsed };
  });

  r.get('/me/notification-prefs', { schema: { response: { 200: notificationPrefsSchema } } }, async (req) => {
    const user = await repo.findById(req.user.id);
    if (!user) throw new ApiError(404, 'Not Found', 'User not found.');
    return notificationPrefsSchema.parse(user.notificationPrefs ?? {});
  });

  r.put('/me/notification-prefs', { schema: { body: notificationPrefsSchema, response: { 200: notificationPrefsSchema } } }, async (req) => {
    const prefs = notificationPrefsSchema.parse(req.body);
    const updated = await repo.updateNotificationPrefs(req.orgId, req.user.id, prefs);
    if (!updated) throw new ApiError(404, 'Not Found', 'User not found.');
    return notificationPrefsSchema.parse(updated.notificationPrefs ?? {});
  });
}
