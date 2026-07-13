// SPDX-License-Identifier: AGPL-3.0-only

import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Db } from '@tessio/db';
import { loginSettingsRepo } from '@tessio/db';

// Defaults mirrored from the login_settings column defaults — used when no row
// exists yet (the public branding route never inserts).
const DEFAULTS = {
  brandName: 'Tessio',
  logo: null as string | null,
  headline: 'Welcome back',
  tagline: 'Sign in to your workspace to pick up where you left off.',
  accent: '#4f46e5', // matches the portal_settings accent column default
};

// Logos are stored inline as data: URLs; the settings UI downscales before
// upload, the cap here is a backstop against oversized payloads.
const logoValue = z.string().max(400_000).refine(
  (v) => v === '' || v.startsWith('data:image/'),
  'logo must be a data:image/* URL',
);

const patchBody = z.object({
  brandName: z.string().min(1).max(80).optional(),
  logo: logoValue.optional(),
  headline: z.string().min(1).max(120).optional(),
  tagline: z.string().max(200).optional(),
});
const settingsResponse = z.record(z.unknown());
const brandingResponse = z.object({
  brandName: z.string(),
  logo: z.string().nullable(),
  headline: z.string(),
  tagline: z.string(),
  accent: z.string(),
});

/** Admin-only sign-in page branding. Caller must be guarded by requireRole('admin'). */
export function registerLoginSettingsRoutes(app: FastifyInstance, db: Db): void {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get('/login-settings', { schema: { response: { 200: settingsResponse } } }, async (req) => {
    return loginSettingsRepo(db).getOrCreate(req.orgId);
  });

  r.patch('/login-settings', { schema: { body: patchBody, response: { 200: settingsResponse } } }, async (req) => {
    await loginSettingsRepo(db).getOrCreate(req.orgId);
    const { logo, ...rest } = req.body;
    return loginSettingsRepo(db).update(req.orgId, {
      ...rest,
      // Empty string clears the logo back to the default mark.
      ...(logo !== undefined ? { logo: logo === '' ? null : logo } : {}),
      updatedBy: req.user.id,
    });
  });
}

/**
 * Public — no session required. The sign-in screen fetches its branding before
 * anyone is authenticated, so this resolves the deployment's default org and
 * falls back to stock branding when nothing is configured.
 */
export function registerLoginBrandingRoute(app: FastifyInstance, db: Db): void {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get('/auth/login-branding', { schema: { response: { 200: brandingResponse } } }, async () => {
    const found = await loginSettingsRepo(db).findForDefaultOrg();
    const row = found?.settings;
    return {
      brandName: row?.brandName ?? DEFAULTS.brandName,
      logo: row?.logo ?? DEFAULTS.logo,
      headline: row?.headline ?? DEFAULTS.headline,
      tagline: row?.tagline ?? DEFAULTS.tagline,
      accent: found?.accent ?? DEFAULTS.accent,
    };
  });
}
