// SPDX-License-Identifier: AGPL-3.0-only

import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import type { Db } from '@tessio/db';
import { workflowsRepo } from '@tessio/db';
import {
  WORKFLOW_EVENTS_QUEUE,
  WORKFLOW_RUNS_QUEUE,
  NOTIFICATIONS_QUEUE,
  type WorkflowEventJobData,
  type WorkflowRunJobData,
  type NotificationEventJob,
} from '@tessio/shared';

/** Injectable seam: integration tests stub these instead of touching Redis. */
export interface WorkflowProducers {
  /** Fan a ticket activity event out to workflow triggers (fire-and-forget). */
  publishEvent(db: Db, orgId: string, event: WorkflowEventJobData['event']): Promise<void>;
  /** Enqueue an already-created run for execution. */
  enqueueRun(orgId: string, runId: string): Promise<void>;
  /** Publish a ticket activity event to the notifications queue (no workflow guard). */
  publishNotification(db: Db, orgId: string, event: NotificationEventJob['event']): Promise<void>;
}

let events: Queue<WorkflowEventJobData> | null = null;
let runs: Queue<WorkflowRunJobData> | null = null;
let notifications: Queue<NotificationEventJob> | null = null;

function connection() {
  return new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: null });
}

/** Lazy queues so the API only connects to Redis once workflows are in use. */
function eventsQueue(): Queue<WorkflowEventJobData> {
  if (!events) events = new Queue<WorkflowEventJobData>(WORKFLOW_EVENTS_QUEUE, { connection: connection() });
  return events;
}
function runsQueue(): Queue<WorkflowRunJobData> {
  if (!runs) runs = new Queue<WorkflowRunJobData>(WORKFLOW_RUNS_QUEUE, { connection: connection() });
  return runs;
}
function notificationsQueue(): Queue<NotificationEventJob> {
  if (!notifications) notifications = new Queue<NotificationEventJob>(NOTIFICATIONS_QUEUE, { connection: connection() });
  return notifications;
}

export const realWorkflowProducers: WorkflowProducers = {
  async publishEvent(db, orgId, event) {
    try {
      // Cheap guard: most orgs have no active workflows; skip Redis entirely then.
      if (!(await workflowsRepo(db).hasActive(orgId))) return;
      await eventsQueue().add('event', { orgId, event }, { attempts: 3, backoff: { type: 'exponential', delay: 2000 } });
    } catch (err) {
      // Workflow fan-out is best-effort; a Redis failure must not break ticket writes.
      console.error('failed to publish workflow event', err);
    }
  },

  async enqueueRun(orgId, runId) {
    await runsQueue().add('run', { orgId, runId }, { attempts: 3, backoff: { type: 'exponential', delay: 2000 } });
  },

  async publishNotification(_db, orgId, event) {
    try {
      await notificationsQueue().add('notification', { orgId, event }, { attempts: 3, backoff: { type: 'exponential', delay: 2000 } });
    } catch (err) {
      // Notification fan-out is best-effort; a Redis failure must not break ticket writes.
      console.error('failed to publish notification event', err);
    }
  },
};
