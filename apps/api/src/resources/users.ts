// SPDX-License-Identifier: AGPL-3.0-only

import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Db } from '@tessio/db';
import { usersRepo, hashPassword } from '@tessio/db';
import { isBillableRole, getSeatLimit } from '@tessio/entitlements';
import { notFound, conflict } from '../errors';
import { recordAudit, safeMeta } from '../audit';
import { assertSeatsAvailable, seatLimitError } from '../seats';

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
    if (isBillableRole(b.role)) await assertSeatsAvailable(db, req.orgId);
    const created = await usersRepo(db).create({
      orgId: req.orgId,
      email: b.email,
      name: b.name,
      role: b.role,
      passwordHash: await hashPassword(b.password),
    });
    void recordAudit(db, { orgId: req.orgId, actorId: req.user.id, actorEmail: req.user.email, action: 'user.created', targetType: 'user', targetId: created.id, metadata: { role: created.role }, ip: req.ip });
    reply.code(201);
    return safe(created as UserRow);
  });

  r.post('/users/import', { schema: { body: importBody, response: { 200: importResult } } }, async (req) => {
    const created: z.infer<typeof importResult>['created'] = [];
    const skipped: z.infer<typeof importResult>['skipped'] = [];
    const seen = new Set<string>();
    // Count billable seats once, then track increments locally so a bulk import
    // stops exactly at the limit instead of re-querying per row.
    const seatLimit = getSeatLimit();
    let seatsUsed = await usersRepo(db).countBillable(req.orgId);
    for (const u of req.body.users) {
      const email = u.email.toLowerCase();
      if (seen.has(email)) { skipped.push({ email: u.email, reason: 'duplicate row in file' }); continue; }
      seen.add(email);
      if (await usersRepo(db).findByEmail(req.orgId, email)) { skipped.push({ email: u.email, reason: 'already exists' }); continue; }
      if (isBillableRole(u.role) && seatLimit !== null && seatsUsed + 1 > seatLimit) {
        skipped.push({ email: u.email, reason: `seat limit reached (${seatsUsed} of ${seatLimit} admin/agent seats in use)` });
        continue;
      }
      const password = generatePassword();
      const row = await usersRepo(db).create({
        orgId: req.orgId,
        email,
        name: u.name,
        role: u.role,
        passwordHash: await hashPassword(password),
      });
      void recordAudit(db, { orgId: req.orgId, actorId: req.user.id, actorEmail: req.user.email, action: 'user.created', targetType: 'user', targetId: row.id, metadata: { role: row.role, via: 'import' }, ip: req.ip });
      created.push({ email: row.email, name: row.name, role: row.role, password });
      if (isBillableRole(row.role)) seatsUsed += 1;
    }
    return { created, skipped };
  });

  r.patch('/users/:id', { schema: { params: z.object({ id: z.string().uuid() }), body: updateBody, response: { 200: userOut } } }, async (req) => {
    const { id } = req.params;
    const b = req.body;
    let row = await usersRepo(db).findById(id);
    if (!row || row.orgId !== req.orgId) throw notFound(`users ${id} not found`);
    // A role/status change that turns a non-billable user into an active
    // admin/agent occupies a new seat — same check as creating one.
    const wasBillable = row.status === 'active' && isBillableRole(row.role);
    const becomesBillable = (b.status ?? row.status) === 'active' && isBillableRole(b.role ?? row.role);
    if (!wasBillable && becomesBillable) {
      const seatLimit = getSeatLimit();
      const seatsUsed = await usersRepo(db).countBillable(req.orgId);
      if (seatLimit !== null && seatsUsed + 1 > seatLimit) throw seatLimitError(seatLimit, seatsUsed);
    }
    if (b.status) row = await usersRepo(db).setStatus(id, b.status);
    if (b.role) row = await usersRepo(db).setRole(id, b.role);
    void recordAudit(db, { orgId: req.orgId, actorId: req.user.id, actorEmail: req.user.email, action: 'user.updated', targetType: 'user', targetId: id, metadata: safeMeta(req.body as Record<string, unknown>, ['role', 'status']), ip: req.ip });
    return safe(row as UserRow);
  });
}
