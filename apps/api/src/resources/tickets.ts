// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod';
import type { Db } from '@tessio/db';
import { ticketsRepo, recordActivity, diffTicketActivity, slaSettingsRepo } from '@tessio/db';
import { baseCreateFields } from './schemas';
import type { ResourceConfig, ResourceRepo } from './resource-routes';
import { enqueueTriageIfEnabled } from '../ai/triage-producer';
import { enqueueEmbedIfEnabled } from '../ai/embed-producer';
import { statusTimestamps, computeSlaTargets } from '@tessio/shared';
import type { WorkflowProducers } from '../workflows/producer';

const ticketCreate = z.object({
  ...baseCreateFields,
  status: z.string().optional(),
  priority: z.string().optional(),
  requesterId: z.string().uuid().optional(),
  assigneeId: z.string().uuid().optional(),
  teamId: z.string().uuid().optional(),
  dueAt: z.coerce.date().optional(),
  parentId: z.string().uuid().optional(),
});

// Update allows clearing nullable fields (assignee / team / due) by sending null.
const ticketUpdate = ticketCreate.partial().omit({ schemaId: true, schemaVersion: true }).extend({
  assigneeId: z.string().uuid().nullable().optional(),
  teamId: z.string().uuid().nullable().optional(),
  dueAt: z.coerce.date().nullable().optional(),
});

export function ticketsResource(db: Db, workflows?: WorkflowProducers): ResourceConfig {
  return {
    path: 'tickets',
    repo: ticketsRepo(db) as unknown as ResourceRepo,
    createSchema: ticketCreate,
    updateSchema: ticketUpdate,
    createRoles: ['admin', 'agent', 'requester'],
    readRoles: ['admin', 'agent', 'requester'],
    writeRoles: ['admin', 'agent'],
    requesterScoped: true,
    teamScoped: true,
    // Stamp resolved_at / closed_at on status transitions (the columns are otherwise never written).
    transformUpdate: (before, patch) => {
      if (!('status' in patch)) return patch;
      return { ...patch, ...statusTimestamps(before.status, patch.status, new Date()) };
    },
    afterCreate: async ({ orgId, actorId }, row) => {
      await recordActivity(db, { orgId, actorId, recordType: 'ticket', recordId: row.id as string, eventType: 'created' });
      void workflows?.publishEvent(db, orgId, { eventType: 'created', recordId: row.id as string });
      void workflows?.publishNotification(db, orgId, { eventType: 'created', recordId: row.id as string, actorId });
      void enqueueTriageIfEnabled(db, orgId, row.id as string);
      void enqueueEmbedIfEnabled(db, orgId, row.id as string);
      const sla = await slaSettingsRepo(db).getOrCreate(orgId);
      if (sla?.enabled) {
        const due = computeSlaTargets(row.createdAt as Date, (row.priority as string | null) ?? null, sla.targets);
        if (due) await ticketsRepo(db).setSlaTargets(orgId, row.id as string, due);
      }
    },
    afterUpdate: async ({ orgId, actorId }, before, after) => {
      for (const event of diffTicketActivity(before, after)) {
        await recordActivity(db, {
          orgId, actorId, recordType: 'ticket', recordId: after.id as string,
          eventType: event.eventType, changes: event.changes,
        });
        void workflows?.publishEvent(db, orgId, { eventType: event.eventType, recordId: after.id as string, changes: event.changes });
        void workflows?.publishNotification(db, orgId, { eventType: event.eventType, recordId: after.id as string, actorId, changes: event.changes });
      }
      const oldData = (before.data ?? {}) as Record<string, unknown>;
      const newData = (after.data ?? {}) as Record<string, unknown>;
      if (oldData.title !== newData.title || oldData.description !== newData.description) {
        void enqueueEmbedIfEnabled(db, orgId, after.id as string);
      }
      if (before.priority !== after.priority) {
        const sla = await slaSettingsRepo(db).getOrCreate(orgId);
        if (sla?.enabled) {
          const due = computeSlaTargets(after.createdAt as Date, (after.priority as string | null) ?? null, sla.targets);
          await ticketsRepo(db).setSlaTargets(orgId, after.id as string, due ?? { responseDueAt: null, resolutionDueAt: null });
        }
      }
    },
  };
}
