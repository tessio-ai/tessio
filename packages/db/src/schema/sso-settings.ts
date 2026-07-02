// SPDX-License-Identifier: AGPL-3.0-only

import { pgTable, boolean, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';

export const ssoSettings = pgTable('sso_settings', {
  id: boolean('id').primaryKey().default(true),
  enabled: boolean('enabled').notNull().default(false),
  issuer: text('issuer'),
  clientId: text('client_id'),
  clientSecretCiphertext: text('client_secret_ciphertext'),
  buttonLabel: text('button_label').notNull().default('Sign in with SSO'),
  autoCreateUsers: boolean('auto_create_users').notNull().default(false),
  allowedDomain: text('allowed_domain'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedBy: uuid('updated_by').references(() => users.id),
});
