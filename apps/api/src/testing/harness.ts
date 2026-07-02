// SPDX-License-Identifier: AGPL-3.0-only

import { createTestDb } from '@tessio/db/testing';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app';
import { loadEnterprise } from '../enterprise/load';
import { usersRepo, sessionsRepo, hashPassword } from '@tessio/db';
import type { TestDb } from '@tessio/db/testing';
import { diskStorage } from '../storage/storage';
import type { WorkflowProducers } from '../workflows/producer';

export { resetDb, seedOrgAndSchema, createTestDb } from '@tessio/db/testing';

/** Capturing stub for the workflow queues — tests assert on the arrays instead of Redis. */
export function stubWorkflowProducers(): WorkflowProducers & {
  publishedEvents: { orgId: string; eventType: string; recordId: string }[];
  enqueuedRuns: { orgId: string; runId: string }[];
} {
  const publishedEvents: { orgId: string; eventType: string; recordId: string }[] = [];
  const enqueuedRuns: { orgId: string; runId: string }[] = [];
  return {
    publishedEvents,
    enqueuedRuns,
    async publishEvent(_db, orgId, event) {
      publishedEvents.push({ orgId, eventType: event.eventType, recordId: event.recordId });
    },
    async enqueueRun(orgId, runId) {
      enqueuedRuns.push({ orgId, runId });
    },
    async publishNotification() {},
  };
}

/** Build the app wired to the test db. Caller closes both via teardown(). */
export function buildTestApp(opts: { workflowProducers?: WorkflowProducers } = {}): {
  app: FastifyInstance;
  teardown: () => Promise<void>;
} {
  const db = createTestDb();
  const storageDir = mkdtempSync(join(tmpdir(), 'tessio-test-storage-'));
  const app = buildApp({ db, storage: diskStorage(storageDir), workflowProducers: opts.workflowProducers ?? stubWorkflowProducers() });
  return {
    app,
    teardown: async () => {
      await app.close();
      await db.$client.end();
      rmSync(storageDir, { recursive: true, force: true });
    },
  };
}

/**
 * Build the app WITH the Enterprise Edition plugin loaded, for testing
 * enterprise routes (SSO settings, audit viewer). The caller must set
 * `process.env.TESSIO_EDITION = 'enterprise'` before calling so the loader and
 * the per-feature entitlement checks are active.
 */
export async function buildEnterpriseTestApp(opts: { workflowProducers?: WorkflowProducers } = {}): Promise<{
  app: FastifyInstance;
  teardown: () => Promise<void>;
}> {
  const db = createTestDb();
  const storageDir = mkdtempSync(join(tmpdir(), 'tessio-test-storage-'));
  const enterprise = await loadEnterprise();
  const app = buildApp({ db, storage: diskStorage(storageDir), workflowProducers: opts.workflowProducers ?? stubWorkflowProducers(), enterprise });
  return {
    app,
    teardown: async () => {
      await app.close();
      await db.$client.end();
      rmSync(storageDir, { recursive: true, force: true });
    },
  };
}

type Role = 'admin' | 'agent' | 'requester';

/** Insert a user of the given role in an org; returns the row + plaintext password. */
export async function seedUser(db: TestDb, opts: { orgId: string; role: Role; email?: string; password?: string }) {
  const email = opts.email ?? `${opts.role}-${crypto.randomUUID()}@t.io`;
  const password = opts.password ?? 'pw';
  const user = await usersRepo(db).create({
    orgId: opts.orgId,
    email,
    name: opts.role,
    role: opts.role,
    passwordHash: await hashPassword(password),
  });
  return { user, email, password };
}

/** Create a session for a (new or given) user and return a ready-to-send signed cookie. */
export async function loginAs(
  app: FastifyInstance,
  db: TestDb,
  opts: { orgId: string; role: Role; userId?: string },
): Promise<{ cookie: string; userId: string }> {
  await app.ready();
  let userId = opts.userId;
  if (!userId) userId = (await seedUser(db, { orgId: opts.orgId, role: opts.role })).user.id;
  const session = await sessionsRepo(db).create({ userId, orgId: opts.orgId });
  const signed = app.signCookie(session.id);
  return { cookie: `tessio_session=${signed}`, userId };
}
