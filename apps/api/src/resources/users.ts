// SPDX-License-Identifier: AGPL-3.0-only

import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Db } from '@tessio/db';
import { usersRepo, sessionsRepo, hashPassword } from '@tessio/db';
import { isBillableRole } from '@tessio/entitlements';
import { notFound, conflict, ApiError } from '../errors';
import { recordAudit, safeMeta } from '../audit';
import { withSeatGuard } from '../seats';

const roleEnum = z.enum(['admin', 'agent', 'requester']);
const statusEnum = z.enum(['active', 'disabled']);

const createBody = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: roleEnum,
  password: z.string().min(8),
});
const updateBody = z.object({ status: statusEnum.optional(), role: roleEnum.optional() });

const importBody = z.object({
  users: z
    .array(z.object({ email: z.string().email(), name: z.string().min(1), role: roleEnum }))
    .min(1)
    .max(1000),
});
const importResult = z.object({
  created: z.array(z.object({ email: z.string(), name: z.string(), role: roleEnum, password: z.string() })),
  skipped: z.array(z.object({ email: z.string(), reason: z.string() })),
});

/** A strong random password for an imported user; returned to the admin once so they can distribute it. */
function generatePassword(): string {
  return randomUUID().replace(/-/g, '').slice(0, 14) + 'Aa1!';
}

const userOut = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  role: roleEnum,
  status: statusEnum,
  createdAt: z.coerce.string(),
});

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'agent' | 'requester';
  status: 'active' | 'disabled';
  createdAt: Date | string;
  [key: string]: unknown;
};
const safe = (u: UserRow) => ({ id: u.id, email: u.email, name: u.name, role: u.role, status: u.status, createdAt: String(u.createdAt) });

/** GET /users (list) — reachable by agent + admin. Caller must already be guarded for read. */
export function registerUserReadRoutes(app: FastifyInstance, db: Db): void {
  const r = app.withTypeProvider<ZodTypeProvider>();
  r.get('/users', { schema: { response: { 200: z.array(userOut) } } }, async (req) => {
    const rows = await usersRepo(db).list(req.orgId);
    return rows.map((u) => safe(u as UserRow));
  });
}

/** Admin-only user management. Caller must already be guarded by requireRole('admin'). */
export function registerUserRoutes(app: FastifyInstance, db: Db): void {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.post('/users', { schema: { body: createBody, response: { 201: userOut } } }, async (req, reply) => {
    const b = req.body;
    if (await usersRepo(db).findByEmail(req.orgId, b.email)) throw conflict('A user with that email already exists');
    const values = {
      orgId: req.orgId,
      email: b.email,
      name: b.name,
      role: b.role,
      passwordHash: await hashPassword(b.password),
    };
    // A billable create takes its seat atomically under the org's seat guard.
    const created = isBillableRole(b.role)
      ? await withSeatGuard(db, req.orgId, (tx) => usersRepo(tx).create(values))
      : await usersRepo(db).create(values);
    void recordAudit(db, { orgId: req.orgId, actorId: req.user.id, actorEmail: req.user.email, action: 'user.created', targetType: 'user', targetId: created.id, metadata: { role: created.role }, ip: req.ip });
    reply.code(201);
    return safe(created as UserRow);
  });

  r.post('/users/import', { schema: { body: importBody, response: { 200: importResult } } }, async (req) => {
    const created: z.infer<typeof importResult>['created'] = [];
    const skipped: z.infer<typeof importResult>['skipped'] = [];
    const seen = new Set<string>();
    for (const u of req.body.users) {
      const email = u.email.toLowerCase();
      if (seen.has(email)) { skipped.push({ email: u.email, reason: 'duplicate row in file' }); continue; }
      seen.add(email);
      if (await usersRepo(db).findByEmail(req.orgId, email)) { skipped.push({ email: u.email, reason: 'already exists' }); continue; }
      const password = generatePassword();
      const values = { orgId: req.orgId, email, name: u.name, role: u.role, passwordHash: await hashPassword(password) };
      let row;
      try {
        // Billable rows take their seat under the org's seat guard; when the
        // org is full the guard's 402 becomes this row's skip reason (import
        // continues — requester rows are always free).
        row = isBillableRole(u.role)
          ? await withSeatGuard(db, req.orgId, (tx) => usersRepo(tx).create(values))
          : await usersRepo(db).create(values);
      } catch (err) {
        if (err instanceof ApiError && err.status === 402) {
          skipped.push({ email: u.email, reason: `${err.title.toLowerCase()}: ${err.detail ?? ''}`.trim() });
          continue;
        }
        throw err;
      }
      void recordAudit(db, { orgId: req.orgId, actorId: req.user.id, actorEmail: req.user.email, action: 'user.created', targetType: 'user', targetId: row.id, metadata: { role: row.role, via: 'import' }, ip: req.ip });
      created.push({ email: row.email, name: row.name, role: row.role, password });
    }
    return { created, skipped };
  });

  // Admin-initiated reset: generates a fresh password, shown to the admin once
  // (mirrors the import flow). Works even when the org has no SMTP configured —
  // the self-serve emailed flow lives at /auth/forgot-password.
  r.post(
    '/users/:id/reset-password',
    { schema: { params: z.object({ id: z.string().uuid() }), response: { 200: z.object({ password: z.string() }) } } },
    async (req) => {
      const { id } = req.params;
      const row = await usersRepo(db).findById(id);
      if (!row || row.orgId !== req.orgId) throw notFound(`users ${id} not found`);
      const password = generatePassword();
      await usersRepo(db).setPasswordHash(id, await hashPassword(password));
      // The old credential may be compromised — revoke every session it opened.
      await sessionsRepo(db).deleteAllForUser(id);
      void recordAudit(db, { orgId: req.orgId, actorId: req.user.id, actorEmail: req.user.email, action: 'user.password_reset_by_admin', targetType: 'user', targetId: id, ip: req.ip });
      return { password };
    },
  );

  r.patch('/users/:id', { schema: { params: z.object({ id: z.string().uuid() }), body: updateBody, response: { 200: userOut } } }, async (req) => {
    const { id } = req.params;
    const b = req.body;
    let row = await usersRepo(db).findById(id);
    if (!row || row.orgId !== req.orgId) throw notFound(`users ${id} not found`);
    // A role/status change that turns a non-billable user into an active
    // admin/agent occupies a new seat — same atomic guard as creating one.
    const wasBillable = row.status === 'active' && isBillableRole(row.role);
    const becomesBillable = (b.status ?? row.status) === 'active' && isBillableRole(b.role ?? row.role);
    const apply = async (tx: typeof db) => {
      let updated = row!;
      if (b.status) updated = await usersRepo(tx).setStatus(id, b.status);
      if (b.role) updated = await usersRepo(tx).setRole(id, b.role);
      return updated;
    };
    row = !wasBillable && becomesBillable ? await withSeatGuard(db, req.orgId, apply) : await apply(db);
    void recordAudit(db, { orgId: req.orgId, actorId: req.user.id, actorEmail: req.user.email, action: 'user.updated', targetType: 'user', targetId: id, metadata: safeMeta(req.body as Record<string, unknown>, ['role', 'status']), ip: req.ip });
    return safe(row as UserRow);
  });
}
