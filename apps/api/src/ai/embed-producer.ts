// SPDX-License-Identifier: AGPL-3.0-only

import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import type { Db } from '@tessio/db';
import { AI_EMBED_QUEUE } from '@tessio/ai';
import { resolveAiSettings } from './resolve';

export interface EmbedJobData {
  orgId: string;
  ticketId: string;
}

let queue: Queue<EmbedJobData> | null = null;

function getQueue(): Queue<EmbedJobData> {
  if (!queue) {
    const connection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: null });
    queue = new Queue<EmbedJobData>(AI_EMBED_QUEUE, { connection });
  }
  return queue;
}

/** Enqueue an embed job only if the org has AI + similar enabled. Never throws into the request path. */
export async function enqueueEmbedIfEnabled(db: Db, orgId: string, ticketId: string): Promise<void> {
  try {
    const settings = await resolveAiSettings(db, orgId);
    if (!settings.enabled || !settings.features.similar) return;
    await getQueue().add('embed', { orgId, ticketId }, { attempts: 3, backoff: { type: 'exponential', delay: 2000 } });
  } catch (err) {
    console.error('failed to enqueue embed', err);
  }
}
