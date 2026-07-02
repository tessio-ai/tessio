// SPDX-License-Identifier: AGPL-3.0-only

import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Db } from '@tessio/db';
import { sessionsRepo } from '@tessio/db';
import { ApiError } from '../errors';
import { readSessionId } from './cookies';
import type { AuthUser } from './roles';

/** preHandler: require a valid session; decorate req.user + req.orgId. */
export function registerAuthContext(app: FastifyInstance, db: Db): void {
  app.decorateRequest('orgId', '');
  app.decorateRequest('user', null as unknown as AuthUser);
  app.addHook('preHandler', async (req: FastifyRequest) => {
    const sid = readSessionId(req);
    if (!sid) throw new ApiError(401, 'Unauthorized', 'Not authenticated');
    const found = await sessionsRepo(db).findValid(sid);
    if (!found) throw new ApiError(401, 'Unauthorized', 'Not authenticated');
    req.user = { id: found.user.id, orgId: found.session.orgId, role: found.user.role, email: found.user.email };
    req.orgId = found.session.orgId;
  });
}
