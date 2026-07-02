// SPDX-License-Identifier: AGPL-3.0-only

import { pgTable, pgEnum, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { foundationColumns } from './foundation';

export const assetStatus = pgEnum('asset_status', ['in_use', 'in_stock', 'retired']);

/** Assets (spec 4.4). */
export const assets = pgTable(
  'assets',
  {
    ...foundationColumns,
    assetTag: text('asset_tag'),
    serial: text('serial'),
    status: assetStatus('status'),
    ownerId: uuid('owner_id'),
    location: text('location'),
    purchasedAt: timestamp('purchased_at', { withTimezone: true }),
    warrantyExpiresAt: timestamp('warranty_expires_at', { withTimezone: true }),
  },
  (t) => [
    index('assets_org_idx').on(t.orgId),
    index('assets_org_status_idx').on(t.orgId, t.status),
    index('assets_data_gin_idx').using('gin', t.data),
  ],
);
