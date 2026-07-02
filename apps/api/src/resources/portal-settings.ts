// SPDX-License-Identifier: AGPL-3.0-only

import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Db } from '@tessio/db';
import { portalSettingsRepo } from '@tessio/db';
import { portalCategory, portalHero, portalCatalogConfig } from '@tessio/shared';

const patchBody = z.object({
  brandName: z.string().min(1).optional(),
  logo: z.string().optional(),
  heroHeadline: z.string().min(1).optional(),
  heroIntro: z.string().optional(),
  accent: z.string().optional(),
  showTess: z.boolean().optional(),
  categories: z.array(portalCategory).optional(),
  hero: portalHero.optional(),
  catalog: portalCatalogConfig.optional(),
});
const settingsResponse = z.record(z.unknown());

/** Admin-only portal homepage settings. Caller must be guarded by requireRole('admin'). */
export function registerPortalSettingsRoutes(app: FastifyInstance, db: Db): void {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get('/portal-settings', { schema: { response: { 200: settingsResponse } } }, async (req) => {
    return portalSettingsRepo(db).getOrCreate(req.orgId);
  });

  r.patch('/portal-settings', { schema: { body: patchBody, response: { 200: settingsResponse } } }, async (req) => {
    await portalSettingsRepo(db).getOrCreate(req.orgId);
    return portalSettingsRepo(db).update(req.orgId, { ...req.body, updatedBy: req.user.id });
  });
}
