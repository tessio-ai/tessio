// SPDX-License-Identifier: AGPL-3.0-only

import type { SchemaDefinition } from '@tessio/shared';

/** A cursor page envelope, matching the API's list/query JSON shape. */
export interface Page<T> {
  rows: T[];
  nextCursor: string | null;
}

/** The ticket fields the UI reads (the API returns more; this is a subset). */
export interface TicketRow {
  id: string;
  number: number | null;
  status: string | null;
  priority: string | null;
  requesterId: string | null;
  assigneeId: string | null;
  teamId: string | null;
  dueAt: string | null;
  schemaId: string;
  schemaVersion: number;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  formId: string | null;
  /** Parent ticket id when this ticket is a subtask; null for top-level tickets. */
  parentId: string | null;
  /** SLA fields — present when SLA is configured; null otherwise. */
  slaResponseDueAt: string | null;
  slaResolutionDueAt: string | null;
  firstRespondedAt: string | null;
  slaResponseBreachedAt: string | null;
  slaResolutionBreachedAt: string | null;
}

/** A record-type definition row from GET /schemas. */
export interface SchemaRow {
  id: string;
  kind: string;
  key: string;
  name: string;
  version: number;
  status: string;
  definition: SchemaDefinition;
}

export interface AssetRow {
  id: string;
  schemaId: string;
  schemaVersion: number;
  assetTag: string | null;
  serial: string | null;
  status: 'in_use' | 'in_stock' | 'retired' | null;
  ownerId: string | null;
  location: string | null;
  purchasedAt: string | null;
  warrantyExpiresAt: string | null;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface KbArticleRow {
  id: string;
  title: string | null;
  slug: string | null;
  status: 'draft' | 'published' | null;
  publishedAt: string | null;
  authorId: string | null;
  schemaId: string;
  schemaVersion: number;
  data: Record<string, unknown>;
  contentVersion: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface LinkRow {
  id: string;
  fromType: string;
  fromId: string;
  toType: string;
  toId: string;
  relationshipType: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface CommentRow {
  id: string;
  recordType: string;
  recordId: string;
  authorId: string | null;
  body: string;
  internal: boolean;
  createdAt: string;
}

/** Error thrown by the client for a non-2xx problem+json response. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public title: string,
    public detail?: string,
  ) {
    super(detail ?? title);
  }
}
