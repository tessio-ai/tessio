// SPDX-License-Identifier: AGPL-3.0-only

import { pgTable, uuid, integer, text, timestamp, index } from 'drizzle-orm/pg-core';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { foundationColumns } from './foundation';
import { users } from './users';
import { forms } from './forms';
import { teams } from './teams';

/**
 * Tickets (spec 4.4). `status`/`priority` are free text because their allowed
 * values are schema-driven/configurable per ticket type. `number` is the
 * per-org human-readable sequence (assigned by ticketsRepo, see repositories).
 */
export const tickets = pgTable(
  'tickets',
  {
    ...foundationColumns,
    number: integer('number'),
    status: text('status'),
    priority: text('priority'),
    requesterId: uuid('requester_id').references(() => users.id),
    assigneeId: uuid('assignee_id').references(() => users.id),
    teamId: uuid('team_id').references(() => teams.id),
    dueAt: timestamp('due_at', { withTimezone: true }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    slaResponseDueAt: timestamp('sla_response_due_at', { withTimezone: true }),
    slaResolutionDueAt: timestamp('sla_resolution_due_at', { withTimezone: true }),
    firstRespondedAt: timestamp('first_responded_at', { withTimezone: true }),
    slaResponseBreachedAt: timestamp('sla_response_breached_at', { withTimezone: true }),
    slaResolutionBreachedAt: timestamp('sla_resolution_breached_at', { withTimezone: true }),
    parentId: uuid('parent_id').references((): AnyPgColumn => tickets.id),
    formId: uuid('form_id').references(() => forms.id),
  },
  (t) => [
    index('tickets_org_idx').on(t.orgId),
    index('tickets_org_status_idx').on(t.orgId, t.status),
    index('tickets_org_assignee_idx').on(t.orgId, t.assigneeId),
    index('tickets_org_due_idx').on(t.orgId, t.dueAt),
    index('tickets_data_gin_idx').using('gin', t.data),
    index('tickets_org_sla_res_idx').on(t.orgId, t.slaResolutionDueAt),
  ],
);
