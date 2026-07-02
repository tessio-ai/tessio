// SPDX-License-Identifier: AGPL-3.0-only

import {
  workflowsRepo,
  ticketsRepo,
  secretsRepo,
  addComment,
  recordActivity,
  type Db,
} from '@tessio/db';
import { decryptSecret } from '@tessio/ai';
import type { WorkflowGraph } from '@tessio/shared';
import type { EngineDeps } from './engine';
import type { ProcessEventDeps } from './process-event';
import { applyTicketUpdate } from './ticket-actions';
import { executeRun } from './engine';

/** POST a snippet to the runner service; 422 carries the script's own error. */
export function runnerClient(baseUrl: string) {
  const token = process.env.RUNNER_TOKEN;
  return async function runScript(code: string, ctx: unknown, timeoutMs: number): Promise<unknown> {
    const res = await fetch(`${baseUrl}/run`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ code, ctx, timeoutMs }),
    });
    const body = (await res.json()) as { output?: unknown; error?: string };
    if (!res.ok) throw new Error(body.error ?? `Script runner responded ${res.status}.`);
    return body.output;
  };
}

export function buildProcessEventDeps(db: Db, enqueueRun: (orgId: string, runId: string) => Promise<void>): ProcessEventDeps {
  const repo = workflowsRepo(db);
  return {
    listActiveWorkflows: async (orgId) =>
      (await repo.listActive(orgId)).map((w) => ({ id: w.id, version: w.version, publishedGraph: w.publishedGraph as WorkflowGraph })),
    getTicket: async (orgId, ticketId) => ticketsRepo(db).getById(orgId, ticketId) as Promise<Record<string, unknown> | undefined>,
    createRun: async (values) => workflowsRepo(db).createRun(values),
    enqueueRun,
  };
}

function buildEngineDeps(db: Db, orgId: string, runnerUrl: string): EngineDeps {
  const repo = workflowsRepo(db);
  const tickets = ticketsRepo(db);
  const secretKey = process.env.TESSIO_SECRET_KEY;
  return {
    loadSecrets: async () => {
      if (!secretKey) return {};
      const rows = await secretsRepo(db).listCiphertexts(orgId);
      return Object.fromEntries(rows.map((r) => [r.name, decryptSecret(r.valueCiphertext, secretKey)]));
    },
    markRunning: async (runId) => {
      await repo.updateRun(runId, { status: 'running', startedAt: new Date() });
    },
    finishRun: async (runId, patch) => {
      await repo.updateRun(runId, { status: patch.status, error: patch.error ?? null, context: patch.context, finishedAt: new Date() });
    },
    createNodeRun: async (runId, nodeId, input) => (await repo.createNodeRun({ runId, nodeId, input })).id,
    finishNodeRun: async (id, patch) => {
      await repo.updateNodeRun(id, { ...patch, finishedAt: new Date() });
    },
    exec: {
      updateTicket: (ticketId, set) =>
        applyTicketUpdate(
          {
            getTicket: (id) => tickets.getById(orgId, id) as Promise<Record<string, unknown> | undefined>,
            patchTicket: (id, patch) => tickets.update(orgId, id, patch) as Promise<Record<string, unknown> | undefined>,
            recordActivity: async (e) => {
              await recordActivity(db, { orgId, recordType: 'ticket', recordId: e.ticketId, eventType: e.eventType, changes: e.changes });
            },
          },
          ticketId,
          set,
        ),
      addComment: async (ticketId, body, internal) => {
        const row = await addComment(db, { orgId, recordType: 'ticket', recordId: ticketId, body, internal });
        await recordActivity(db, { orgId, recordType: 'ticket', recordId: ticketId, eventType: 'commented', changes: { internal } });
        return { commentId: row.id };
      },
      fetchFn: fetch,
      runScript: runnerClient(runnerUrl),
    },
  };
}

/** Load a queued run and execute it (the workflow-runs job processor). */
export async function processRunJob(db: Db, data: { orgId: string; runId: string }, runnerUrl: string): Promise<void> {
  const repo = workflowsRepo(db);
  const run = await repo.getRun(data.orgId, data.runId);
  if (!run) return;
  if (run.status !== 'queued') return; // already executed (job retry after success)
  await executeRun(buildEngineDeps(db, data.orgId, runnerUrl), {
    id: run.id,
    graph: run.graph as WorkflowGraph,
    triggerContext: run.triggerContext as Record<string, unknown>,
  });
}
