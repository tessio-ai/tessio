// SPDX-License-Identifier: AGPL-3.0-only

import {
  workflowsRepo,
  ticketsRepo,
  secretsRepo,
  slackSettingsRepo,
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
import { postSlackWebhook } from '../slack/send';

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
      createSubtask: async (parentId, fields) => {
        const parent = (await tickets.getById(orgId, parentId)) as Record<string, unknown> | undefined;
        if (!parent) throw new Error(`Ticket ${parentId} not found.`);
        const data: Record<string, unknown> = {
          ...(fields.data ?? {}),
          title: fields.title,
          ...(fields.description !== undefined ? { description: fields.description } : {}),
        };
        const child = await tickets.create({
          orgId,
          schemaId: parent.schemaId as string,
          schemaVersion: parent.schemaVersion as number,
          parentId,
          teamId: (fields.teamId ?? (parent.teamId as string | null)) ?? null,
          assigneeId: fields.assigneeId ?? null,
          priority: fields.priority ?? null,
          status: fields.status ?? null,
          data,
        });
        // Record the child's creation for its timeline, but do NOT publish a workflow
        // event — workflows must not re-trigger workflows (v1 loop guard, see design doc).
        await recordActivity(db, { orgId, recordType: 'ticket', recordId: child.id as string, eventType: 'created' });
        return { ticketId: child.id as string, number: child.number as number };
      },
      addComment: async (ticketId, body, internal) => {
        const row = await addComment(db, { orgId, recordType: 'ticket', recordId: ticketId, body, internal });
        await recordActivity(db, { orgId, recordType: 'ticket', recordId: ticketId, eventType: 'commented', changes: { internal } });
        return { commentId: row.id };
      },
      fetchFn: fetch,
      runScript: runnerClient(runnerUrl),
      sendSlack: async (text) => {
        const row = await slackSettingsRepo(db).getOrCreate(orgId);
        if (!row?.enabled || !row.webhookUrlCiphertext || !secretKey) {
          throw new Error('Slack integration is not configured — connect it under Settings → Slack.');
        }
        const webhookUrl = decryptSecret(row.webhookUrlCiphertext, secretKey);
        await postSlackWebhook(fetch, webhookUrl, { text });
      },
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
