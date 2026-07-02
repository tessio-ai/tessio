// SPDX-License-Identifier: AGPL-3.0-only

import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Db } from '@tessio/db';
import { agentEnrollmentKeysRepo } from '@tessio/db';
import { ApiError } from '../errors';
import { recordAudit, safeMeta } from '../audit';
import { generateToken, hashToken, tokenHint } from './token';

const idParam = z.object({ id: z.string().uuid() });
const createBody = z.object({ label: z.string().max(120).optional() });

const presented = z.object({
  id: z.string(),
  label: z.string(),
  hint: z.string(),
  createdAt: z.string(),
  revokedAt: z.string().nullable(),
});

/** Created key includes the plaintext exactly once. */
const created = presented.extend({ key: z.string() });

/** Admin-only enrollment-key management. Caller must be guarded by requireRole('admin'). */
export function registerEnrollmentKeysRoutes(app: FastifyInstance, db: Db): void {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const repo = agentEnrollmentKeysRepo(db);

  r.get('/agent/enrollment-keys', { schema: { response: { 200: z.array(presented) } } }, async (req) => {
    return (await repo.list(req.orgId)).map((k) => ({
      id: k.id,
      label: k.label,
      hint: k.hint,
      createdAt: k.createdAt.toISOString(),
      revokedAt: k.revokedAt ? k.revokedAt.toISOString() : null,
    }));
  });

  r.post('/agent/enrollment-keys', { schema: { body: createBody, response: { 201: created } } }, async (req, reply) => {
    const key = generateToken();
    const row = await repo.create({
      orgId: req.orgId,
      label: req.body.label ?? '',
      keyHash: hashToken(key),
      hint: tokenHint(key),
      createdBy: req.user.id,
    });
    void recordAudit(db, {
      orgId: req.orgId,
      actorId: req.user.id,
      actorEmail: req.user.email,
      action: 'agent.enrollment_key.created',
      targetType: 'agent_enrollment_key',
      targetId: row.id,
      metadata: safeMeta(req.body as Record<string, unknown>, ['label']),
      ip: req.ip,
    });
    reply.code(201);
    return {
      id: row.id,
      label: row.label,
      hint: row.hint,
      createdAt: row.createdAt.toISOString(),
      revokedAt: null,
      key,
    };
  });

  r.post('/agent/enrollment-keys/:id/revoke', { schema: { params: idParam, response: { 200: presented } } }, async (req) => {
    const row = await repo.revoke(req.orgId, req.params.id);
    if (!row) throw new ApiError(404, 'Not Found', 'No active enrollment key with that id.');
    void recordAudit(db, {
      orgId: req.orgId,
      actorId: req.user.id,
      actorEmail: req.user.email,
      action: 'agent.enrollment_key.revoked',
      targetType: 'agent_enrollment_key',
      targetId: row.id,
      ip: req.ip,
    });
    return {
      id: row.id,
      label: row.label,
      hint: row.hint,
      createdAt: row.createdAt.toISOString(),
      revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
    };
  });
}
