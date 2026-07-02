// SPDX-License-Identifier: AGPL-3.0-only

export interface AgentOfflineDeps {
  now(): Date;
  staleAfterMs: number;
  /** Flip devices with no heartbeat since the cutoff to offline; returns count. */
  markOfflineStale(staleBefore: Date): Promise<number>;
}

/** Mark devices offline when their last heartbeat is older than the window. */
export async function runAgentOfflineTick(deps: AgentOfflineDeps): Promise<void> {
  const staleBefore = new Date(deps.now().getTime() - deps.staleAfterMs);
  try {
    await deps.markOfflineStale(staleBefore);
  } catch (err) {
    console.error('agent offline tick failed', err);
  }
}
