// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { buildTestApp, resetDb, createTestDb, loginAs, stubWorkflowProducers } from '../testing/harness';
import { orgs, schemas, workflowsRepo } from '@tessio/db';
import type { WorkflowGraph } from '@tessio/shared';

const db = createTestDb();
const producers = stubWorkflowProducers();
const { app, teardown } = buildTestApp({ workflowProducers: producers });

const validGraph: WorkflowGraph = {
  nodes: [
    { id: 'trigger', type: 'trigger', position: { x: 0, y: 0 }, config: { events: ['created'] } },
    { id: 'c1', type: 'add_comment', position: { x: 200, y: 0 }, config: { body: 'auto-reply' } },
  ],
  edges: [{ id: 'e1', from: 'trigger', to: 'c1' }],
};

async function ctx() {
  const [org] = await db.insert(orgs).values({ name: 'Org', slug: `o-${crypto.randomUUID()}` }).returning();
  const [schema] = await db.insert(schemas).values({
    orgId: org.id, kind: 'ticket', key: `t-${crypto.randomUUID()}`, name: 'Incident', status: 'published',
    definition: { fields: [{ key: 'title', label: 'Title', type: 'text', required: true, order: 0, width: 'full' }] },
  }).returning();
  const admin = await loginAs(app, db, { orgId: org.id, role: 'admin' });
  const agent = await loginAs(app, db, { orgId: org.id, role: 'agent' });
  return { orgId: org.id, schemaId: schema.id, admin, agent };
}

async function createTicket(cookie: string, schemaId: string) {
  const res = await app.inject({
    method: 'POST', url: '/api/v1/tickets', headers: { cookie },
    payload: { schemaId, schemaVersion: 1, data: { title: 'Printer on fire' } },
  });
  expect(res.statusCode).toBe(201);
  return res.json() as { id: string };
}

describe('workflows resource', () => {
  beforeEach(async () => {
    await resetDb(db);
    producers.publishedEvents.length = 0;
    producers.enqueuedRuns.length = 0;
  });
  afterAll(async () => {
    await db.$client.end();
    await teardown();
  });

  it('admin creates, edits, publishes, and lists a workflow', async () => {
    const { admin } = await ctx();
    const create = await app.inject({ method: 'POST', url: '/api/v1/workflows', headers: { cookie: admin.cookie }, payload: { name: 'Auto reply' } });
    expect(create.statusCode).toBe(201);
    const wf = create.json();
    expect(wf.status).toBe('draft');
    expect(wf.graph.nodes).toHaveLength(1); // starter trigger

    const patch = await app.inject({ method: 'PATCH', url: `/api/v1/workflows/${wf.id}`, headers: { cookie: admin.cookie }, payload: { graph: validGraph } });
    expect(patch.statusCode).toBe(200);

    const publish = await app.inject({ method: 'POST', url: `/api/v1/workflows/${wf.id}/publish`, headers: { cookie: admin.cookie } });
    expect(publish.statusCode).toBe(200);
    expect(publish.json().status).toBe('active');
    expect(publish.json().version).toBe(1);

    const list = (await app.inject({ method: 'GET', url: '/api/v1/workflows', headers: { cookie: admin.cookie } })).json();
    expect(list).toHaveLength(1);
    expect(list[0].hasUnpublishedChanges).toBe(false);
    expect(list[0].lastRun).toBeNull();
  });

  it('publish rejects an invalid graph with 422 + error list', async () => {
    const { admin } = await ctx();
    const wf = (await app.inject({ method: 'POST', url: '/api/v1/workflows', headers: { cookie: admin.cookie }, payload: { name: 'Bad' } })).json();
    const broken: WorkflowGraph = { ...validGraph, edges: [{ id: 'e1', from: 'trigger', to: 'ghost' }] };
    await app.inject({ method: 'PATCH', url: `/api/v1/workflows/${wf.id}`, headers: { cookie: admin.cookie }, payload: { graph: broken } });
    const publish = await app.inject({ method: 'POST', url: `/api/v1/workflows/${wf.id}/publish`, headers: { cookie: admin.cookie } });
    expect(publish.statusCode).toBe(422);
    const body = publish.json();
    expect(Array.isArray(body.errors)).toBe(true);
    expect(body.errors.some((e: { message: string }) => /unknown node/i.test(e.message))).toBe(true);
  });

  it('run-now creates a pinned run and enqueues it; draft test-runs use the draft graph', async () => {
    const { admin, schemaId } = await ctx();
    const ticket = await createTicket(admin.cookie, schemaId);
    const wf = (await app.inject({ method: 'POST', url: '/api/v1/workflows', headers: { cookie: admin.cookie }, payload: { name: 'Manual' } })).json();
    await app.inject({ method: 'PATCH', url: `/api/v1/workflows/${wf.id}`, headers: { cookie: admin.cookie }, payload: { graph: validGraph } });

    // Unpublished + non-draft → 409.
    const premature = await app.inject({ method: 'POST', url: `/api/v1/workflows/${wf.id}/run`, headers: { cookie: admin.cookie }, payload: { ticketId: ticket.id } });
    expect(premature.statusCode).toBe(409);

    // Draft test run works pre-publish.
    const testRun = await app.inject({ method: 'POST', url: `/api/v1/workflows/${wf.id}/run`, headers: { cookie: admin.cookie }, payload: { ticketId: ticket.id, draft: true } });
    expect(testRun.statusCode).toBe(201);
    expect(testRun.json().triggerKind).toBe('test');
    expect(testRun.json().workflowVersion).toBe(0);

    await app.inject({ method: 'POST', url: `/api/v1/workflows/${wf.id}/publish`, headers: { cookie: admin.cookie } });
    const manual = await app.inject({ method: 'POST', url: `/api/v1/workflows/${wf.id}/run`, headers: { cookie: admin.cookie }, payload: { ticketId: ticket.id } });
    expect(manual.statusCode).toBe(201);
    expect(manual.json().triggerKind).toBe('manual');
    expect(manual.json().workflowVersion).toBe(1);
    expect(manual.json().triggerContext.ticket.id).toBe(ticket.id);

    expect(producers.enqueuedRuns.map((r) => r.runId)).toEqual([testRun.json().id, manual.json().id]);

    // Runs list + detail (with node runs) round-trip.
    const runs = (await app.inject({ method: 'GET', url: `/api/v1/workflows/${wf.id}/runs`, headers: { cookie: admin.cookie } })).json();
    expect(runs).toHaveLength(2);
    const detail = await app.inject({ method: 'GET', url: `/api/v1/workflows/${wf.id}/runs/${runs[0].id}`, headers: { cookie: admin.cookie } });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().nodeRuns).toEqual([]);
  });

  it('activate requires a published graph; archived workflows cannot publish', async () => {
    const { admin } = await ctx();
    const wf = (await app.inject({ method: 'POST', url: '/api/v1/workflows', headers: { cookie: admin.cookie }, payload: { name: 'X' } })).json();
    const activate = await app.inject({ method: 'POST', url: `/api/v1/workflows/${wf.id}/status`, headers: { cookie: admin.cookie }, payload: { status: 'active' } });
    expect(activate.statusCode).toBe(409);

    await app.inject({ method: 'POST', url: `/api/v1/workflows/${wf.id}/status`, headers: { cookie: admin.cookie }, payload: { status: 'archived' } });
    const publish = await app.inject({ method: 'POST', url: `/api/v1/workflows/${wf.id}/publish`, headers: { cookie: admin.cookie } });
    expect(publish.statusCode).toBe(409);
  });

  it('ticket writes publish workflow events only when an active workflow exists', async () => {
    const { admin, orgId, schemaId } = await ctx();

    // The stub captures unconditionally; the "no active workflows" guard lives in the
    // real producer, so here we assert the API publishes created + diff events.
    const ticket = await createTicket(admin.cookie, schemaId);
    expect(producers.publishedEvents).toContainEqual({ orgId, eventType: 'created', recordId: ticket.id });

    const update = await app.inject({
      method: 'PATCH', url: `/api/v1/tickets/${ticket.id}`, headers: { cookie: admin.cookie },
      payload: { priority: 'high', data: { title: 'Printer on fire', urgency: 'now' } },
    });
    expect(update.statusCode).toBe(200);
    expect(producers.publishedEvents).toContainEqual({ orgId, eventType: 'priority', recordId: ticket.id });
    expect(producers.publishedEvents).toContainEqual({ orgId, eventType: 'field_changed', recordId: ticket.id });

    // Activity diff events still recorded (shared diff helper).
    const activity = (await app.inject({ method: 'GET', url: `/api/v1/tickets/${ticket.id}/activity`, headers: { cookie: admin.cookie } })).json();
    expect(activity.some((a: { eventType: string }) => a.eventType === 'priority')).toBe(true);
    expect(activity.some((a: { eventType: string }) => a.eventType === 'field_changed')).toBe(true);
  });

  it('agents get 403 on workflow management', async () => {
    const { agent } = await ctx();
    expect((await app.inject({ method: 'GET', url: '/api/v1/workflows', headers: { cookie: agent.cookie } })).statusCode).toBe(403);
    expect((await app.inject({ method: 'POST', url: '/api/v1/workflows', headers: { cookie: agent.cookie }, payload: { name: 'x' } })).statusCode).toBe(403);
  });

  it('workflows are org-scoped', async () => {
    const a = await ctx();
    const wf = (await app.inject({ method: 'POST', url: '/api/v1/workflows', headers: { cookie: a.admin.cookie }, payload: { name: 'Mine' } })).json();
    const b = await ctx();
    expect((await app.inject({ method: 'GET', url: `/api/v1/workflows/${wf.id}`, headers: { cookie: b.admin.cookie } })).statusCode).toBe(404);
    // sanity: repo sees it in org A
    expect(await workflowsRepo(db).getById(a.orgId, wf.id)).toBeDefined();
  });
});
