// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Self-serve password reset (public, pre-session):
 *
 *   POST /auth/forgot-password { email }           → 204 always (no enumeration)
 *   POST /auth/reset-password  { token, password } → 204 | 400
 *
 * The emailed link carries a random 256-bit token; only its SHA-256 hash is
 * stored, it expires after an hour, is single-use, and each new request
 * invalidates prior ones. A successful reset revokes every session the user
 * had. Delivery rides the worker's email queue, so it uses the org's own SMTP
 * settings — if the org hasn't configured email, the request still 204s and
 * an admin can use the admin-reset endpoint instead.
 */

import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Db } from '@tessio/db';
import { usersRepo, sessionsRepo, passwordResetsRepo, hashPassword } from '@tessio/db';
import { ApiError } from '../errors';
import { recordAudit } from '../audit';
import type { WorkflowProducers } from '../workflows/producer';

const forgotBody = z.object({ email: z.string().email() });
const resetBody = z.object({ token: z.string().min(1), password: z.string().min(8) });

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}

export function renderPasswordResetEmail(opts: { name: string; resetUrl: string }): { subject: string; text: string; html: string } {
  const subject = 'Reset your Tessio password';
  const text = [
    `Hi ${opts.name},`,
    '',
    'Someone (hopefully you) asked to reset the password for this account.',
    `Reset it here (the link works once and expires in 1 hour): ${opts.resetUrl}`,
    '',
    "If you didn't ask for this, you can ignore this email — your password is unchanged.",
  ].join('\n');
  const html = [
    `<p>Hi ${escapeHtml(opts.name)},</p>`,
    '<p>Someone (hopefully you) asked to reset the password for this account.</p>',
    `<p><a href="${opts.resetUrl}">Reset your password</a> — the link works once and expires in 1 hour.</p>`,
    "<p>If you didn't ask for this, you can ignore this email — your password is unchanged.</p>",
  ].join('');
  return { subject, text, html };
}

/** Public reset routes — registered on the /api/v1 parent (no session required). */
export function registerPasswordResetRoutes(app: FastifyInstance, db: Db, producers: WorkflowProducers): void {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const siteUrl = (process.env.TESSIO_SITE_URL ?? 'http://localhost').replace(/\/$/, '');

  r.post(
    '/auth/forgot-password',
    { config: { rateLimit: { max: 5, timeWindow: '15 minutes' } }, schema: { body: forgotBody, response: { 204: z.null() } } },
    async (req, reply) => {
      const user = await usersRepo(db).findByEmailGlobal(req.body.email);
      // Same 204 whether or not the account exists — the response must not
      // reveal which emails have accounts. All real work happens after checks.
      if (user && user.status === 'active') {
        const { token } = await passwordResetsRepo(db).create({ orgId: user.orgId, userId: user.id });
        const resetUrl = `${siteUrl}/#/reset-password?token=${token}`;
        const rendered = renderPasswordResetEmail({ name: user.name, resetUrl });
        void producers.enqueueEmail({ orgId: user.orgId, to: user.email, ...rendered });
        void recordAudit(db, { orgId: user.orgId, actorId: null, actorEmail: user.email, action: 'user.password_reset_requested', targetType: 'user', targetId: user.id, ip: req.ip });
      }
      reply.code(204);
      return null;
    },
  );

  r.post(
    '/auth/reset-password',
    { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } }, schema: { body: resetBody, response: { 204: z.null() } } },
    async (req, reply) => {
      const consumed = await passwordResetsRepo(db).consume(req.body.token);
      const user = consumed ? await usersRepo(db).findById(consumed.userId) : undefined;
      if (!consumed || !user || user.status !== 'active') {
        throw new ApiError(400, 'Invalid reset link', 'This reset link is invalid, already used, or expired. Request a new one from the sign-in page.');
      }
      await usersRepo(db).setPasswordHash(user.id, await hashPassword(req.body.password));
      // A reset proves control of the mailbox, not of existing sessions — kick them all.
      await sessionsRepo(db).deleteAllForUser(user.id);
      void recordAudit(db, { orgId: user.orgId, actorId: user.id, actorEmail: user.email, action: 'user.password_reset', targetType: 'user', targetId: user.id, ip: req.ip });
      reply.code(204);
      return null;
    },
  );
}
