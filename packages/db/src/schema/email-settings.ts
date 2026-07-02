// SPDX-License-Identifier: AGPL-3.0-only

import { pgTable, uuid, text, integer, boolean, timestamp } from 'drizzle-orm/pg-core';
import { orgs } from './orgs';
import { schemas } from './schemas';
import { teams } from './teams';
import { users } from './users';

/** One row per org — SMTP (out) + IMAP (in) configuration. Passwords stored encrypted. */
export const emailSettings = pgTable('email_settings', {
  orgId: uuid('org_id').primaryKey().references(() => orgs.id),
  enabled: boolean('enabled').notNull().default(false),
  smtpHost: text('smtp_host'),
  smtpPort: integer('smtp_port'),
  smtpSecure: boolean('smtp_secure').notNull().default(true),
  smtpUser: text('smtp_user'),
  smtpPasswordCiphertext: text('smtp_password_ciphertext'),
  fromName: text('from_name'),
  fromAddress: text('from_address'),
  replyTo: text('reply_to'),
  inboundEnabled: boolean('inbound_enabled').notNull().default(false),
  imapHost: text('imap_host'),
  imapPort: integer('imap_port'),
  imapSecure: boolean('imap_secure').notNull().default(true),
  imapUser: text('imap_user'),
  imapPasswordCiphertext: text('imap_password_ciphertext'),
  mailbox: text('mailbox').notNull().default('INBOX'),
  acceptNewSenders: boolean('accept_new_senders').notNull().default(false),
  defaultSchemaId: uuid('default_schema_id').references(() => schemas.id),
  defaultTeamId: uuid('default_team_id').references(() => teams.id),
  lastSeenUid: integer('last_seen_uid').notNull().default(0),
  uidValidity: integer('uid_validity'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedBy: uuid('updated_by').references(() => users.id),
});
