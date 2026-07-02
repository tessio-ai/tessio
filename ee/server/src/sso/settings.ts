// SPDX-License-Identifier: LicenseRef-Tessio-Commercial

import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { ssoSettingsRepo } from '@tessio/db';
import { encryptSecret } from '@tessio/ai';
import { ssoSettingsInput } from '@tessio/shared';
import type { EnterpriseContext } from '@tessio/entitlements';

const settingsResponse = z.object({
  enabled: z.boolean(),
  issuer: z.string(),
  clientId: z.string(),
  buttonLabel: z.string(),
  autoCreateUsers: z.boolean(),
  allowedDomain: z.string().nullable(),
  clientSecretConfigured: z.boolean(),
  redirectUri: z.string(),
});

type SsoSettingsRow = Awaited<ReturnType<ReturnType<typeof ssoSettingsRepo>['get']>>;

function present(row: NonNullable<SsoSettingsRow>): z.infer<typeof settingsResponse> {
  return {
    enabled: row.enabled,
    issuer: row.issuer ?? '',
    clientId: row.clientId ?? '',
    buttonLabel: row.buttonLabel,
    autoCreateUsers: row.autoCreateUsers,
    allowedDomain: row.allowedDomain ?? null,
    clientSecretConfigured: !!row.clientSecretCiphertext,
    redirectUri: (process.env.TESSIO_SITE_URL ?? 'http://localhost') + '/api/v1/auth/sso/callback',
  };
}

/** Admin-only SSO settings. Caller must be guarded by requireRole('admin'). */
export function registerSsoSettingsRoutes(app: FastifyInstance, ctx: EnterpriseContext): void {
  const { db, recordAudit, safeMeta } = ctx;
  const r = app.withTypeProvider<ZodTypeProvider>();
  const repo = ssoSettingsRepo(db);

  r.get('/sso-settings', { schema: { response: { 200: settingsResponse } } }, async () => {
    return present(await repo.get());
  });

  r.put('/sso-settings', { schema: { body: ssoSettingsInput, response: { 200: settingsResponse } } }, async (req) => {
    // Ensure row exists (lazy-create) before updating.
    await repo.get();
    const body = req.body;
    const patch: Record<string, unknown> = {};

    if (body.enabled !== undefined) patch.enabled = body.enabled;
    if (body.issuer !== undefined) patch.issuer = body.issuer;
    if (body.clientId !== undefined) patch.clientId = body.clientId;
    if (body.buttonLabel !== undefined) patch.buttonLabel = body.buttonLabel;
    if (body.autoCreateUsers !== undefined) patch.autoCreateUsers = body.autoCreateUsers;
    if (body.allowedDomain !== undefined) patch.allowedDomain = body.allowedDomain;
    if (body.clientSecret) {
      patch.clientSecretCiphertext = encryptSecret(body.clientSecret, process.env.TESSIO_SECRET_KEY!);
    }

    const updated = await repo.update(patch);
    void recordAudit(db, { orgId: req.orgId, actorId: req.user.id, actorEmail: req.user.email, action: 'settings.sso.updated', metadata: safeMeta(req.body as Record<string, unknown>, ['enabled', 'inboundEnabled', 'autoCreateUsers', 'acceptNewSenders']), ip: req.ip });
    return present(updated);
  });
}
