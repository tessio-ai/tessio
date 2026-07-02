// SPDX-License-Identifier: AGPL-3.0-only

import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import type { Db } from '@tessio/db';
import { AI_TRIAGE_QUEUE } from '@tessio/ai';
import { resolveAiSettings } from './resolve';

export interface TriageJobData {
  orgId: string;
  ticketId: string;
}

let queue: Queue<TriageJobData> | null = null;

/** Lazily create the BullMQ producer so the API only connects to Redis when AI is actually used. */
function getQueue(): Queue<TriageJobData> {
  if (!queue) {
    const connection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      maxRetriesPerRequest: null,
    });
    queue = new Queue<TriageJobData>(AI_TRIAGE_QUEUE, { connection });
  }
  return queue;
}

/** Enqueue a triage job only if the org has AI + triage enabled. Never throws into the request path. */
export async function enqueueTriageIfEnabled(db: Db, orgId: string, ticketId: string): Promise<void> {
  try {
    const settings = await resolveAiSettings(db, orgId);
    if (!settings.enabled || !settings.features.triage) return;
    await getQueue().add('triage', { orgId, ticketId }, { attempts: 3, backoff: { type: 'exponential', delay: 2000 } });
  } catch (err) {
    // Triage is best-effort; a Redis/config failure must not break ticket creation.
    console.error('failed to enqueue triage', err);
  }
}
