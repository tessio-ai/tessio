// SPDX-License-Identifier: AGPL-3.0-only

import type { FastifyInstance } from 'fastify';
import type { Db } from '@tessio/db';
import type { Storage } from './storage/storage';
import { registerResourceRoutes } from './resources/resource-routes';
import { ticketsResource, registerTicketSubtaskRoutes } from './resources/tickets';
import { assetsResource } from './resources/assets';
import { kbArticlesResource } from './resources/kb-articles';
import { formSubmissionsResource } from './resources/form-submissions';
import { registerCommentRoutes } from './resources/comments';
import { registerActivityRoutes } from './resources/activity';
import { registerLinkRoutes } from './resources/links';
import { registerSchemaRoutes } from './resources/schema-resource';
import { requireRole } from './auth/require-role';
import { registerUserRoutes, registerUserReadRoutes } from './resources/users';
import { registerTeamRoutes, registerTeamReadRoutes } from './resources/teams';
import { registerTeamMemberRoutes } from './resources/team-members';
import { registerTeamSchemaRoutes } from './resources/team-schemas';
import { registerFormRoutes } from './resources/forms';
import { registerSchemaWriteRoutes } from './resources/schema-write';
import { registerPortalSettingsRoutes } from './resources/portal-settings';
import { registerLoginSettingsRoutes } from './resources/login-settings';
import { registerAiSettingsRoutes, registerAiIdentityRoutes } from './resources/ai-settings';
import { registerTicketAiRoutes } from './resources/ticket-ai';
import { registerKbAiRoutes } from './resources/kb-ai';
import { registerAskRoutes } from './resources/ai-ask';
import { registerDashboardRoutes } from './resources/dashboard';
import { registerReportRoutes } from './resources/reports';
import { registerPortalRoutes } from './resources/portal';
import { registerAttachmentRoutes, registerAttachmentByIdRoutes } from './resources/attachments';
import { registerKbRevisionRoutes } from './resources/kb-revisions';
import { registerOrgReadRoutes, registerOrgWriteRoutes } from './resources/org';
import { registerWorkflowRoutes } from './resources/workflows';
import { registerSecretsRoutes } from './resources/secrets';
import { registerEmailSettingsRoutes } from './resources/email-settings';
import { registerSlackSettingsRoutes } from './resources/slack-settings';
import { registerSlaSettingsRoutes } from './resources/sla-settings';
import { registerCsatSettingsRoutes, registerPortalCsatRoutes, registerTicketCsatRoutes } from './resources/csat';
import { registerNotificationsRoutes } from './resources/notifications';
import { registerMeRoutes } from './resources/me';
import { registerEnrollmentKeysRoutes } from './agents/enrollment-keys-routes';
import { registerDevicesRoutes } from './agents/devices-routes';
import type { WorkflowProducers } from './workflows/producer';
import type { EnterprisePlugin, EnterpriseContext } from '@tessio/entitlements';

/** Admin-scoped enterprise wiring, threaded down from buildApp. */
interface EnterpriseWiring {
  enterprise: EnterprisePlugin | null;
  eeCtx: EnterpriseContext;
}

/** Mount all /api/v1 resource routes (called inside the org-scoped v1 plugin). */
export function registerV1Routes(
  app: FastifyInstance,
  db: Db,
  storage: Storage,
  workflowProducers: WorkflowProducers,
  ee?: EnterpriseWiring,
): void {
  registerResourceRoutes(app, ticketsResource(db, workflowProducers));
  registerResourceRoutes(app, assetsResource(db));
  registerResourceRoutes(app, kbArticlesResource(db));
  registerResourceRoutes(app, formSubmissionsResource(db));

  // Portal reads are reachable by any authenticated role (including requesters).
  registerPortalRoutes(app, db);

  // Satisfaction survey submit/read for the caller's own tickets (ownership-checked inside).
  registerPortalCsatRoutes(app, db, workflowProducers);

  // Ticket comments are reachable by requesters (ownership-checked inside).
  registerCommentRoutes(app, db, 'tickets', 'ticket', workflowProducers);

  // Ticket activity is reachable by requesters (ownership-checked inside).
  registerActivityRoutes(app, db, 'tickets', 'ticket');

  // Ticket attachments are reachable by requesters (ownership-checked inside); by-id routes handle all kinds.
  registerAttachmentRoutes(app, db, storage, 'tickets', 'ticket');
  registerAttachmentByIdRoutes(app, db, storage);

  // Any authenticated user.
  registerNotificationsRoutes(app, db);
  registerMeRoutes(app, db);
  // Assistant display name + icon — the console and portal render the bot for
  // every role, so identity reads are not admin-gated (unlike /ai/settings).
  registerAiIdentityRoutes(app, db);

  // Everything else is agent/admin only.
  app.register(async (staff) => {
    staff.addHook('preHandler', requireRole('agent', 'admin'));
    registerCommentRoutes(staff, db, 'assets', 'asset');
    registerCommentRoutes(staff, db, 'kb-articles', 'kb_article');
    registerCommentRoutes(staff, db, 'form-submissions', 'form_submission');

    registerTicketSubtaskRoutes(staff, db);

    registerLinkRoutes(staff, db, 'tickets', 'ticket');
    registerLinkRoutes(staff, db, 'assets', 'asset');
    registerLinkRoutes(staff, db, 'kb-articles', 'kb_article');
    registerLinkRoutes(staff, db, 'form-submissions', 'form_submission');

    registerKbRevisionRoutes(staff, db);
    registerTicketAiRoutes(staff, db);
    registerKbAiRoutes(staff, db);
    registerAskRoutes(staff, db);
    registerDashboardRoutes(staff, db);
    registerReportRoutes(staff, db);
    registerTicketCsatRoutes(staff, db);

    registerDevicesRoutes(staff, db);

    registerSchemaRoutes(staff, db);
    registerUserReadRoutes(staff, db);
    registerTeamReadRoutes(staff, db);
    registerOrgReadRoutes(staff, db);
  });

  app.register(async (adminScope) => {
    adminScope.addHook('preHandler', requireRole('admin'));
    registerUserRoutes(adminScope, db);
    registerTeamRoutes(adminScope, db);
    registerTeamMemberRoutes(adminScope, db);
    registerTeamSchemaRoutes(adminScope, db);
    registerFormRoutes(adminScope, db);
    registerSchemaWriteRoutes(adminScope, db);
    registerPortalSettingsRoutes(adminScope, db);
    registerLoginSettingsRoutes(adminScope, db);
    registerAiSettingsRoutes(adminScope, db);
    registerEmailSettingsRoutes(adminScope, db);
    registerSlackSettingsRoutes(adminScope, db);
    registerSlaSettingsRoutes(adminScope, db);
    registerCsatSettingsRoutes(adminScope, db);
    // Enterprise admin routes (SSO settings, audit viewer) — only when an EE
    // plugin is loaded (paid editions); the plugin self-gates per feature.
    if (ee?.enterprise) ee.enterprise.registerAdmin?.(adminScope, ee.eeCtx);
    registerSecretsRoutes(adminScope, db);
    registerEnrollmentKeysRoutes(adminScope, db);
    registerOrgWriteRoutes(adminScope, db);
    registerWorkflowRoutes(adminScope, db, workflowProducers);
  });
}
