// SPDX-License-Identifier: AGPL-3.0-only

import type { FastifyReply, FastifyRequest } from 'fastify';

export const SESSION_COOKIE = 'tessio_session';
const MAX_AGE = 30 * 24 * 60 * 60; // seconds

/** Read + unsign the session id from the request cookie, or null. */
export function readSessionId(req: FastifyRequest): string | null {
  const raw = req.cookies[SESSION_COOKIE];
  if (!raw) return null;
  const result = req.unsignCookie(raw);
  return result.valid && result.value ? result.value : null;
}

export function setSessionCookie(reply: FastifyReply, id: string): void {
  reply.setCookie(SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    signed: true,
    path: '/',
    maxAge: MAX_AGE,
  });
}

export function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(SESSION_COOKIE, { path: '/' });
}
