// SPDX-License-Identifier: AGPL-3.0-only

import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Db } from '@tessio/db';
import { workflowsRepo, ticketsRepo } from '@tessio/db';
import { workflowGraph, validateWorkflowGraph, type WorkflowGraph } from '@tessio/shared';
import { ApiError, notFound, badRequest, conflict } from '../errors';
import type { WorkflowProducers } from '../workflows/producer';

const idParam = z.object({ id: z.string().uuid() });
const runParam = z.object({ id: z.string().uuid(), runId: z.string().uuid() });
const createBody = z.object({ name: z.string().min(1), description: z.string().optional() });
const updateBody = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  graph: workflowGraph.optional(),
});
const statusBody = z.object({ status: z.enum(['active', 'paused', 'archived']) });
const runBody = z.object({ ticketId: z.string().uuid(), draft: z.boolean().optional() });
const anyResponse = z.record(z.unknown());

/** Validation failures surface as 422 with the per-node/edge error list. */
function assertPublishable(graph: WorkflowGraph): void {
  const errors = validateWorkflowGraph(graph);
  if (errors.length > 0) {
    throw new ApiError(422, 'Unprocessable Entity', 'The workflow graph is not valid.', { errors });
  }
}

/** Admin-only workflow CRUD + publish + runs. Caller must be guarded by requireRole('admin'). */
export function registerWorkflowRoutes(app: FastifyInstance, db: Db, producers: WorkflowProducers): void {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const repo = workflowsRepo(db);

  r.get('/workflows', { schema: { response: { 200: z.array(anyResponse) } } }, async (req) => {
    const rows = await repo.list(req.orgId);
    return Promise.all(
      rows.map(async (w) => {
        const [lastRun] = await repo.listRuns(req.orgId, w.id, 1);
        return {
          ...w,
          hasUnpublishedChanges: w.publishedGraph !== null && JSON.stringify(w.graph) !== JSON.stringify(w.publishedGraph),
          lastRun: lastRun
            ? { id: lastRun.id, status: lastRun.status, createdAt: lastRun.createdAt, finishedAt: lastRun.finishedAt }
            : null,
        };
      }),
    );
  });

  r.post('/workflows', { schema: { body: createBody, response: { 201: anyResponse } } }, async (req, reply) => {
    const created = await repo.create({ orgId: req.orgId, ...req.body, createdBy: req.user.id });
    reply.code(201);
    return created;
  });

  r.get('/workflows/:id', { schema: { params: idParam, response: { 200: anyResponse } } }, async (req) => {
    const wf = await repo.getById(req.orgId, req.params.id);
    if (!wf) throw notFound(`workflow ${req.params.id} not found`);
    return wf;
  });

  r.patch('/workflows/:id', { schema: { params: idParam, body: updateBody, response: { 200: anyResponse } } }, async (req) => {
    const wf = await repo.getById(req.orgId, req.params.id);
    if (!wf) throw notFound(`workflow ${req.params.id} not found`);
    return repo.update(req.orgId, req.params.id, req.body);
  });

  r.post('/workflows/:id/publish', { schema: { params: idParam, response: { 200: anyResponse } } }, async (req) => {
    const wf = await repo.getById(req.orgId, req.params.id);
    if (!wf) throw notFound(`workflow ${req.params.id} not found`);
    if (wf.status === 'archived') throw conflict('Unarchive the workflow before publishing.');
    assertPublishable(wf.graph as WorkflowGraph);
    return repo.publish(req.orgId, req.params.id);
  });

  r.post('/workflows/:id/status', { schema: { params: idParam, body: statusBody, response: { 200: anyResponse } } }, async (req) => {
    const wf = await repo.getById(req.orgId, req.params.id);
    if (!wf) throw notFound(`workflow ${req.params.id} not found`);
    if (req.body.status === 'active' && !wf.publishedGraph) throw conflict('Publish the workflow before activating it.');
    return repo.setStatus(req.orgId, req.params.id, req.body.status);
  });

  r.post('/workflows/:id/run', { schema: { params: idParam, body: runBody, response: { 201: anyResponse } } }, async (req, reply) => {
    const wf = await repo.getById(req.orgId, req.params.id);
    if (!wf) throw notFound(`workflow ${req.params.id} not found`);

    const useDraft = req.body.draft ?? false;
    const graph = (useDraft ? wf.graph : wf.publishedGraph) as WorkflowGraph | null;
    if (!graph) throw conflict('This workflow has never been published — run it with draft: true.');
    if (useDraft) assertPublishable(graph);

    const ticket = await ticketsRepo(db).getById(req.orgId, req.body.ticketId);
    if (!ticket) throw badRequest(`ticket ${req.body.ticketId} not found`);

    const run = await repo.createRun({
      orgId: req.orgId,
      workflowId: wf.id,
      workflowVersion: useDraft ? 0 : wf.version,
      triggerKind: useDraft ? 'test' : 'manual',
      triggerContext: { ticketId: ticket.id, ticket, manualBy: req.user.id },
      graph,
    });
    await producers.enqueueRun(req.orgId, run.id);
    reply.code(201);
    return run;
  });

  r.get('/workflows/:id/runs', { schema: { params: idParam, response: { 200: z.array(anyResponse) } } }, async (req) => {
    if (!(await repo.getById(req.orgId, req.params.id))) throw notFound(`workflow ${req.params.id} not found`);
    return repo.listRuns(req.orgId, req.params.id);
  });

  r.get('/workflows/:id/runs/:runId', { schema: { params: runParam, response: { 200: anyResponse } } }, async (req) => {
    const run = await repo.getRun(req.orgId, req.params.runId);
    if (!run || run.workflowId !== req.params.id) throw notFound(`run ${req.params.runId} not found`);
    const nodeRuns = await repo.listNodeRuns(run.id);
    return { ...run, nodeRuns };
  });
}
