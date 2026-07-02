// SPDX-License-Identifier: LicenseRef-Tessio-Commercial

/**
 * Tessio Enterprise Edition — server plugin.
 *
 * Implements the core `EnterprisePlugin` contract. The core composition root
 * (apps/api) loads this module ONLY in enterprise/cloud editions, via a guarded
 * dynamic import, and calls these hooks at the matching Fastify scopes. Each
 * feature checks its own entitlement before registering anything, so the edition
 * matrix — not the mere presence of this package — decides what is live.
 */

import { isFeatureEnabled, type EnterprisePlugin } from '@tessio/entitlements';
import { registerSsoRoutes } from './sso/routes';
import { registerSsoSettingsRoutes } from './sso/settings';
import { registerAuditRoutes } from './audit/routes';

export const enterprise: EnterprisePlugin = {
  registerPublic(scope, ctx) {
    // SSO start/callback/info live at the public /api/v1 scope (pre-session).
    if (isFeatureEnabled('sso')) registerSsoRoutes(scope, ctx);
  },
  registerAdmin(scope, ctx) {
    // Admin-scoped enterprise routes (already requireRole('admin')).
    if (isFeatureEnabled('sso')) registerSsoSettingsRoutes(scope, ctx);
    // Audit-log viewer (the writer stays in core; only this read surface is gated).
    if (isFeatureEnabled('audit_log')) registerAuditRoutes(scope, ctx);
  },
};

export default enterprise;
