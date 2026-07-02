// SPDX-License-Identifier: AGPL-3.0-only

import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Db } from '@tessio/db';
import { usersRepo, sessionsRepo, verifyPassword } from '@tessio/db';
import { ApiError } from '../errors';
import { readSessionId, setSessionCookie, clearSessionCookie } from './cookies';
import { recordAudit } from '../audit';

// A valid scrypt hash of a random value — compared against when no/disabled user
// is found so login takes constant time regardless of which branch is taken.
const DUMMY_HASH =
  'scrypt$fe69b41319e27b96294c6e6e471b04f8$4cf29466a85dee987b3b794dbfd8bf2731600b5891836e1752fdebfece45f1ea9f6cb9e80995d5a55b2e041711b1549a012aa9bf9059d66c597e2be4c4eb4cf3';

const loginBody = z.object({ email: z.string().email(), password: z.string().min(1) });
const userResponse = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  role: z.enum(['admin', 'agent', 'requester']),
});

/** Public auth routes — registered on the /api/v1 parent (no session required). */
export function registerAuthRoutes(app: FastifyInstance, db: Db): void {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.post('/auth/login', { config: { rateLimit: { max: 15, timeWindow: '5 minutes' } }, schema: { body: loginBody, response: { 200: userResponse } } }, async (req, reply) => {
    const { email, password } = req.body;
    const user = await usersRepo(db).findByEmailGlobal(email);
    // Always perform a scrypt comparison (against a dummy hash if needed) so the
    // response time doesn't reveal whether the email exists / the account is active.
    const passwordOk = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
    const ok = !!user && user.status === 'active' && passwordOk;
    if (!ok || !user) {
      // Record failed login only when a user row was found (we have an org to attach to).
      if (user) {
        void recordAudit(db, { orgId: user.orgId, actorId: null, actorEmail: email, action: 'user.login_failed', ip: req.ip });
      }
      throw new ApiError(401, 'Unauthorized', 'Invalid email or password');
    }
    const session = await sessionsRepo(db).create({ userId: user.id, orgId: user.orgId });
    setSessionCookie(reply, session.id);
    void recordAudit(db, { orgId: user.orgId, actorId: user.id, actorEmail: user.email, action: 'user.login', ip: req.ip });
    return { id: user.id, email: user.email, name: user.name, role: user.role };
  });

  r.get('/auth/me', { schema: { response: { 200: userResponse } } }, async (req) => {
    const sid = readSessionId(req);
    if (!sid) throw new ApiError(401, 'Unauthorized', 'Not authenticated');
    const found = await sessionsRepo(db).findValid(sid);
    if (!found) throw new ApiError(401, 'Unauthorized', 'Not authenticated');
    const u = found.user;
    return { id: u.id, email: u.email, name: u.name, role: u.role };
  });

  r.post('/auth/logout', async (req, reply) => {
    const sid = readSessionId(req);
    if (sid) {
      const found = await sessionsRepo(db).findValid(sid);
      if (found) {
        void recordAudit(db, { orgId: found.session.orgId, actorId: found.user.id, actorEmail: found.user.email, action: 'user.logout', ip: req.ip });
      }
      await sessionsRepo(db).delete(sid);
    }
    clearSessionCookie(reply);
    reply.code(204);
  });
}
