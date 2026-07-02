// SPDX-License-Identifier: AGPL-3.0-only

import type { SchemaRow } from '../../api/types';

const KEYWORDS: { match: RegExp; key: string }[] = [
  { match: /incident/i, key: 'incident' },
  { match: /problem/i, key: 'problem' },
  { match: /change/i, key: 'change' },
  { match: /request|service/i, key: 'request' },
];

/** Map each ticket schemaId -> a TYPE_MAP key (incident/request/problem/change) by its key/name. Default 'request'. */
export function ticketTypeKeyById(schemas: SchemaRow[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const s of schemas) {
    const hay = `${s.key} ${s.name}`;
    out[s.id] = KEYWORDS.find((k) => k.match.test(hay))?.key ?? 'request';
  }
  return out;
}
