// SPDX-License-Identifier: AGPL-3.0-only

import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { orgs } from './orgs';
import { agentDevices } from './agent-devices';

/**
 * Installed-software inventory for an agent device. Rows are replaced wholesale
 * on each full snapshot, so this always reflects the latest report.
 */
export const agentSoftware = pgTable(
  'agent_software',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => orgs.id),
    deviceId: uuid('device_id').notNull().references(() => agentDevices.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    version: text('version'),
    publisher: text('publisher'),
    installedAt: timestamp('installed_at', { withTimezone: true }),
  },
  (t) => [
    index('agent_software_device_idx').on(t.deviceId),
    index('agent_software_org_name_idx').on(t.orgId, t.name),
  ],
);
