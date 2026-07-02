// SPDX-License-Identifier: AGPL-3.0-only

import { evaluateFilterDeep, redactedSecretsScope, resolveSecrets, type WorkflowEdge, type WorkflowGraph, type WorkflowScope } from '@tessio/shared';
import { prepareNodeInput, executeNode, type NodeExecDeps } from './node-runners';

export interface RunRecord {
  id: string;
  graph: WorkflowGraph;
  triggerContext: Record<string, unknown>;
}

export interface EnginePersistence {
  markRunning(runId: string): Promise<void>;
  finishRun(runId: string, patch: { status: 'completed' | 'failed'; error?: string; context: Record<string, unknown> }): Promise<void>;
  createNodeRun(runId: string, nodeId: string, input: unknown): Promise<string>;
  finishNodeRun(id: string, patch: { status: 'completed' | 'failed'; output?: unknown; error?: string }): Promise<void>;
}

export type EngineDeps = EnginePersistence & {
  exec: NodeExecDeps;
  loadSecrets: () => Promise<Record<string, string>>;
};

/** First conditional edge that matches the scope wins; else-edge is the fallback. */
export function pickBranchEdge(outgoing: WorkflowEdge[], scope: WorkflowScope): WorkflowEdge | undefined {
  for (const e of outgoing) {
    if (e.condition && evaluateFilterDeep(e.condition, scope)) return e;
  }
  return outgoing.find((e) => e.else);
}

/**
 * Token-walking DAG executor (spec 5.5, single-job variant). Parallel branches run
 * concurrently in-process; joins gate on in-memory arrival counts (`all` waits for
 * every incoming edge, `any` fires once). A node failure fails the run and stops
 * new tokens from being scheduled; in-flight branches settle.
 */
export async function executeRun(deps: EngineDeps, run: RunRecord): Promise<void> {
  const { graph } = run;
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const outgoing = (id: string) => graph.edges.filter((e) => e.from === id);
  const inboundCount = (id: string) => graph.edges.filter((e) => e.to === id).length;

  const trigger = graph.nodes.find((n) => n.type === 'trigger');
  if (!trigger) {
    await deps.finishRun(run.id, { status: 'failed', error: 'Graph has no trigger node.', context: {} });
    return;
  }

  const secrets = await deps.loadSecrets();

  const scope: WorkflowScope = {
    trigger: run.triggerContext,
    ticket: (run.triggerContext.ticket ?? {}) as Record<string, unknown>,
    nodes: {},
    run: { id: run.id },
  };

  const joinArrivals = new Map<string, number>();
  const joinFired = new Set<string>();
  let runError: string | undefined;

  async function advance(nodeId: string): Promise<void> {
    if (runError) return;
    const node = byId.get(nodeId);
    if (!node) {
      runError = `Edge points at unknown node "${nodeId}".`;
      return;
    }

    if (node.type === 'join') {
      const arrivals = (joinArrivals.get(nodeId) ?? 0) + 1;
      joinArrivals.set(nodeId, arrivals);
      if (node.config.mode === 'all' && arrivals < inboundCount(nodeId)) return; // park until the last token
      if (joinFired.has(nodeId)) return; // `any` already fired (or duplicate last arrival)
      joinFired.add(nodeId);
    }

    // Recorded input keeps {{ secrets.x }} literal (no plaintext in run history).
    const scopeWithSecrets = { ...scope, secrets: redactedSecretsScope() };
    const recordedInput = prepareNodeInput(node, scopeWithSecrets);
    const nodeRunId = await deps.createNodeRun(run.id, node.id, recordedInput);
    // Live input resolves secrets; never persisted.
    const liveInput = node.type === 'script' ? recordedInput : resolveSecrets(recordedInput, secrets);
    let successors: string[];
    try {
      let output: unknown;
      if (node.type === 'branch') {
        const edge = pickBranchEdge(outgoing(node.id), scope);
        output = { edge: edge ? (edge.label ?? edge.id) : null };
        successors = edge ? [edge.to] : [];
      } else if (node.type === 'join') {
        output = { arrivals: joinArrivals.get(node.id), mode: node.config.mode };
        successors = followEdges(node.id);
      } else {
        ({ output } = await executeNode(node, liveInput, scope, deps.exec, secrets));
        successors = followEdges(node.id);
      }
      scope.nodes[node.id] = { output };
      await deps.finishNodeRun(nodeRunId, { status: 'completed', output });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await deps.finishNodeRun(nodeRunId, { status: 'failed', error: message });
      runError = `Node "${node.name ?? node.id}" failed: ${message}`;
      return;
    }
    await Promise.all(successors.map((id) => advance(id)));
  }

  /** Non-branch fan-out: follow every outgoing edge whose (optional) condition matches. */
  function followEdges(nodeId: string): string[] {
    return outgoing(nodeId)
      .filter((e) => !e.condition || evaluateFilterDeep(e.condition, scope))
      .map((e) => e.to);
  }

  await deps.markRunning(run.id);
  try {
    await Promise.all(followEdges(trigger.id).map((id) => advance(id)));
  } catch (err) {
    // advance() persists its own failures; this catches persistence-layer throws.
    runError = runError ?? (err instanceof Error ? err.message : String(err));
  }

  await deps.finishRun(run.id, {
    status: runError ? 'failed' : 'completed',
    error: runError,
    context: { nodes: scope.nodes },
  });
}
