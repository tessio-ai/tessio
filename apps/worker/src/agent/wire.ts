// SPDX-License-Identifier: AGPL-3.0-only

import { agentDevicesRepo, type Db } from '@tessio/db';
import { AGENT_OFFLINE_AFTER_MS } from '@tessio/shared';
import type { AgentOfflineDeps } from './tick';

export function buildAgentOfflineDeps(db: Db): AgentOfflineDeps {
  return {
    now: () => new Date(),
    staleAfterMs: Number(process.env.AGENT_OFFLINE_AFTER_MS ?? AGENT_OFFLINE_AFTER_MS),
    markOfflineStale: async (staleBefore) => (await agentDevicesRepo(db).markOfflineStale(staleBefore)).length,
  };
}
