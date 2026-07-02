// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod';
import type { Db } from '@tessio/db';
import { assetsRepo } from '@tessio/db';
import { baseCreateFields } from './schemas';
import type { ResourceConfig, ResourceRepo } from './resource-routes';
import { resolveAssetNaming } from './asset-naming';

const assetCreate = z.object({
  ...baseCreateFields,
  assetTag: z.string().optional(),
  serial: z.string().optional(),
  status: z.enum(['in_use', 'in_stock', 'retired']).optional(),
  ownerId: z.string().uuid().optional(),
  location: z.string().optional(),
  purchasedAt: z.coerce.date().optional(),
  warrantyExpiresAt: z.coerce.date().optional(),
});
const assetUpdate = assetCreate.partial().omit({ schemaId: true, schemaVersion: true });

export function assetsResource(db: Db): ResourceConfig {
  return {
    path: 'assets',
    repo: assetsRepo(db) as unknown as ResourceRepo,
    createSchema: assetCreate,
    updateSchema: assetUpdate,
    transformCreate: (orgId, body) => resolveAssetNaming(db, orgId, body),
  };
}
