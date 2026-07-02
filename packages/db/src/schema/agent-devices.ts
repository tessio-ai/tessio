// SPDX-License-Identifier: AGPL-3.0-only

import { pgTable, pgEnum, uuid, text, integer, bigint, jsonb, timestamp, index, unique } from 'drizzle-orm/pg-core';
import { orgs } from './orgs';
import { users } from './users';
import { assets } from './assets';
import { agentEnrollmentKeys } from './agent-enrollment-keys';

export const agentOsTypeEnum = pgEnum('agent_os_type', ['windows', 'macos', 'linux']);
export const agentDeviceStatus = pgEnum('agent_device_status', ['online', 'offline']);

/**
 * Auto-discovered devices reported by the endpoint agent. This is the machine-managed
 * side of the CMDB, kept separate from the human-curated `assets` table but optionally
 * linkable to one via `linkedAssetId`. A dedicated table (not the schema-driven
 * `foundationColumns` record machinery) since the shape is fixed, not org-defined.
 */
export const agentDevices = pgTable(
  'agent_devices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => orgs.id),
    enrollmentKeyId: uuid('enrollment_key_id').references(() => agentEnrollmentKeys.id),
    /** sha256 hex of the per-device bearer token. */
    tokenHash: text('token_hash').notNull(),
    /** Stable hardware identifier; unique per org so re-enrollment upserts. */
    machineId: text('machine_id').notNull(),

    hostname: text('hostname').notNull().default(''),
    osType: agentOsTypeEnum('os_type').notNull(),
    osVersion: text('os_version'),
    osBuild: text('os_build'),
    manufacturer: text('manufacturer'),
    model: text('model'),
    serial: text('serial'),
    cpu: text('cpu'),
    cpuCores: integer('cpu_cores'),
    ramBytes: bigint('ram_bytes', { mode: 'number' }),
    lastUser: text('last_user'),
    lastBootAt: timestamp('last_boot_at', { withTimezone: true }),
    agentVersion: text('agent_version'),

    status: agentDeviceStatus('status').notNull().default('online'),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    lastReportAt: timestamp('last_report_at', { withTimezone: true }),

    linkedAssetId: uuid('linked_asset_id').references(() => assets.id),
    /** Network interfaces, disks, and any extra raw collector output. */
    data: jsonb('data').$type<Record<string, unknown>>().notNull().default({}),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id),
    updatedBy: uuid('updated_by').references(() => users.id),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('agent_devices_org_idx').on(t.orgId),
    index('agent_devices_org_status_idx').on(t.orgId, t.status),
    index('agent_devices_token_idx').on(t.tokenHash),
    index('agent_devices_linked_asset_idx').on(t.linkedAssetId),
    unique('agent_devices_org_machine').on(t.orgId, t.machineId),
  ],
);
