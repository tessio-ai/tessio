// SPDX-License-Identifier: AGPL-3.0-only

import type { Db } from '@tessio/db';
import { schemasRepo, assignNextNumber } from '@tessio/db';
import { resolveTemplate } from '@tessio/shared';

/** Resolve an asset's tag (atomic {seq}) and name from the type's templates when omitted. */
export async function resolveAssetNaming(
  db: Db,
  orgId: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const schemaId = body.schemaId as string | undefined;
  if (!schemaId) return body;

  const schema = await schemasRepo(db).getById(orgId, schemaId);
  const def = schema?.definition as { tagTemplate?: string; nameTemplate?: string } | undefined;
  if (!schema || !def) return body;

  const data = { ...((body.data as Record<string, unknown>) ?? {}) };
  const next: Record<string, unknown> = { ...body, data };

  const base = () => ({
    ...data,
    asset_tag: next.assetTag ?? '',
    serial: next.serial,
    status: next.status,
    location: next.location,
  });

  if (!next.assetTag && def.tagTemplate) {
    let seq: number | undefined;
    if (/\{seq(:\d+)?\}/.test(def.tagTemplate)) {
      seq = await assignNextNumber(db, orgId, `asset_tag:${schema.key}`);
    }
    const tag = resolveTemplate(def.tagTemplate, { ...base(), seq });
    if (tag) next.assetTag = tag;
  }

  if (!data.name && def.nameTemplate) {
    const name = resolveTemplate(def.nameTemplate, base());
    if (name) data.name = name;
  }

  return next;
}
