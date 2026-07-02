// SPDX-License-Identifier: AGPL-3.0-only

import type { FastifyRequest } from 'fastify';
import { ApiError } from '../errors';
import type { Role } from './roles';
import './roles'; // load the FastifyRequest.user declaration

/** preHandler guard: 403 unless the authenticated user's role is in `roles`. */
export function requireRole(...roles: Role[]) {
  return async (req: FastifyRequest): Promise<void> => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new ApiError(403, 'Forbidden', 'Insufficient permissions');
    }
  };
}
