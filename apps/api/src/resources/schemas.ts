// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod';
import { filterNode, sortField } from '@tessio/shared';

/** Fields every record create body carries (system FK + custom data). */
export const baseCreateFields = {
  schemaId: z.string().uuid(),
  schemaVersion: z.number().int().positive(),
  data: z.record(z.unknown()).optional(),
};

/** Permissive record response — strict per-resource response schemas are a later refinement. */
export const recordResponse = z.record(z.unknown());

/** Path param for a record id. */
export const idParam = z.object({ id: z.string().uuid() });

/** GET list query-string: simple pagination (rich filtering goes through POST /query). */
export const listQuery = z.object({
  limit: z.coerce.number().int().positive().max(200).optional(),
  cursor: z.string().optional(),
});

/** POST /query body: the shared filter AST + a single sort key + cursor pagination. */
export const queryBody = z.object({
  filter: filterNode.optional(),
  sort: sortField.optional(),
  limit: z.number().int().positive().max(200).optional(),
  cursor: z.string().optional(),
});

/** Page envelope returned by list/query. */
export const pageResponse = z.object({
  rows: z.array(recordResponse),
  nextCursor: z.string().nullable(),
});
