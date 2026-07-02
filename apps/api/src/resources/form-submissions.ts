// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod';
import type { Db } from '@tessio/db';
import { formSubmissionsRepo } from '@tessio/db';
import { baseCreateFields } from './schemas';
import type { ResourceConfig, ResourceRepo } from './resource-routes';

const formCreate = z.object({
  ...baseCreateFields,
  formSchemaId: z.string().uuid().optional(),
  submittedBy: z.string().uuid().optional(),
  source: z.enum(['portal', 'internal']).optional(),
});
const formUpdate = formCreate.partial().omit({ schemaId: true, schemaVersion: true });

export function formSubmissionsResource(db: Db): ResourceConfig {
  return {
    path: 'form-submissions',
    repo: formSubmissionsRepo(db) as unknown as ResourceRepo,
    createSchema: formCreate,
    updateSchema: formUpdate,
    createRoles: ['admin', 'agent', 'requester'],
    readRoles: ['admin', 'agent'],
    writeRoles: ['admin', 'agent'],
  };
}
