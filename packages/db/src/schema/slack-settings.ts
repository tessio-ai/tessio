// SPDX-License-Identifier: AGPL-3.0-only

import { pgTable, uuid, text, boolean, timestamp } from 'drizzle-orm/pg-core';
import { orgs } from './orgs';
import { users } from './users';

/** One row per org — Slack incoming-webhook configuration. Webhook URL stored encrypted. */
export const slackSettings = pgTable('slack_settings', {
  orgId: uuid('org_id').primaryKey().references(() => orgs.id),
  enabled: boolean('enabled').notNull().default(false),
  webhookUrlCiphertext: text('webhook_url_ciphertext'),
  notifyCreated: boolean('notify_created').notNull().default(true),
  notifyAssigned: boolean('notify_assigned').notNull().default(true),
  notifyStatus: boolean('notify_status').notNull().default(true),
  notifyCommented: boolean('notify_commented').notNull().default(true),
  notifySlaBreach: boolean('notify_sla_breach').notNull().default(true),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedBy: uuid('updated_by').references(() => users.id),
});
