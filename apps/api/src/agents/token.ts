// SPDX-License-Identifier: AGPL-3.0-only

import { randomBytes, createHash } from 'node:crypto';
import type { FastifyRequest } from 'fastify';

/** Generate a fresh bearer credential (enrollment key or per-device token). */
export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

/** One-way hash stored in the DB; we verify by hashing the presented value and matching. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** A 4-char display hint shown alongside a stored credential. */
export function tokenHint(token: string): string {
  return token.slice(-4);
}

/** Extract the `Authorization: Bearer <token>` value, or '' if absent. */
export function bearerToken(req: FastifyRequest): string {
  const header = req.headers.authorization ?? '';
  return header.startsWith('Bearer ') ? header.slice(7) : '';
}
