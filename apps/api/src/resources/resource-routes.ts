// SPDX-License-Identifier: AGPL-3.0-only

import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z, type ZodTypeAny } from 'zod';
import type { FilterNode } from '@tessio/shared';
import { recordResponse, idParam, listQuery, queryBody, pageResponse } from './schemas';
import { notFound } from '../errors';
import { requireRole } from '../auth/require-role';
import type { Role } from '../auth/roles';

export interface TeamScope {
  userId: string;
  role: string;
}

export interface ResourceRepo {
  create(values: Record<string, unknown>): Promise<Record<string, unknown>>;
  getById(orgId: string, id: string, teamScope?: TeamScope): Promise<Record<string, unknown> | undefined>;
  update(orgId: string, id: string, patch: Record<string, unknown>): Promise<Record<string, unknown> | undefined>;
  softDelete(orgId: string, id: string): Promise<void>;
  query(
    orgId: string,
    opts: { filter?: unknown; sort?: unknown; limit?: number; cursor?: string },
    teamScope?: { userId: string; role: string },
  ): Promise<{ rows: Record<string, unknown>[]; nextCursor: string | null }>;
}

export interface ResourceConfig {
  path: string;
  repo: ResourceRepo;
  createSchema: ZodTypeAny;
  updateSchema: ZodTypeAny;
  /** Roles allowed to create. Default: admin + agent. */
  createRoles?: Role[];
  /** Roles allowed to read (get/list/query). Default: admin + agent. */
  readRoles?: Role[];
  /** Roles allowed to mutate existing rows (patch/delete). Default: admin + agent. */
  writeRoles?: Role[];
  /** When true, requesters are scoped to rows where requesterId === self. */
  requesterScoped?: boolean;
  /** When true, non-admin agents are filtered to schemas visible to their teams. */
  teamScoped?: boolean;
  /** Optional async transform applied to the create body before insert (e.g. naming). */
  transformCreate?: (orgId: string, body: Record<string, unknown>) => Promise<Record<string, unknown>>;
  /** Optional hook run after a successful create (e.g. record activity). */
  afterCreate?: (ctx: { orgId: string; actorId: string }, created: Record<string, unknown>) => Promise<void>;
  /** Optional hook run after a successful update, with the before/after rows (e.g. record activity). */
  afterUpdate?: (ctx: { orgId: string; actorId: string }, before: Record<string, unknown>, after: Record<string, unknown>) => Promise<void>;
  /** Optional pre-write hook to derive extra patch fields from the current row + incoming patch (e.g. lifecycle timestamps). */
  transformUpdate?: (before: Record<string, unknown>, patch: Record<string, unknown>) => Record<string, unknown>;
}

const DEFAULT_ROLES: Role[] = ['admin', 'agent'];

/** AND a `requesterId == self` leaf onto any caller filter. */
function ownFilter(self: string, base?: FilterNode): FilterNode {
  const own: FilterNode = { field: 'requesterId', op: 'eq', value: self };
  return base ? { and: [base, own] } : own;
}

export function registerResourceRoutes(app: FastifyInstance, cfg: ResourceConfig): void {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const createRoles = cfg.createRoles ?? DEFAULT_ROLES;
  const readRoles = cfg.readRoles ?? DEFAULT_ROLES;
  const writeRoles = cfg.writeRoles ?? DEFAULT_ROLES;
  const scoped = cfg.requesterScoped ?? false;
  const isRequester = (role: Role) => scoped && role === 'requester';
  // For team-scoped resources (tickets), agents may only touch rows whose schema is
  // visible to their teams — enforced on by-id reads/writes, not just list/query.
  const teamScopeFor = (user: { id: string; role: Role }): TeamScope | undefined =>
    cfg.teamScoped ? { userId: user.id, role: user.role } : undefined;

  r.post(
    `/${cfg.path}`,
    { preHandler: requireRole(...createRoles), schema: { body: cfg.createSchema, response: { 201: recordResponse } } },
    async (req, reply) => {
      let body = { ...(req.body as object), orgId: req.orgId } as Record<string, unknown>;
      if (isRequester(req.user.role)) body.requesterId = req.user.id;
      if (cfg.transformCreate) body = await cfg.transformCreate(req.orgId, body);
      const created = await cfg.repo.create(body);
      if (cfg.afterCreate) await cfg.afterCreate({ orgId: req.orgId, actorId: req.user.id }, created);
      reply.code(201);
      return created;
    },
  );

  r.get(
    `/${cfg.path}/:id`,
    { preHandler: requireRole(...readRoles), schema: { params: idParam, response: { 200: recordResponse } } },
    async (req) => {
      const { id } = req.params as z.infer<typeof idParam>;
      const row = await cfg.repo.getById(req.orgId, id, teamScopeFor(req.user));
      if (!row || (isRequester(req.user.role) && row.requesterId !== req.user.id)) {
        throw notFound(`${cfg.path} ${id} not found`);
      }
      return row;
    },
  );

  r.patch(
    `/${cfg.path}/:id`,
    { preHandler: requireRole(...writeRoles), schema: { params: idParam, body: cfg.updateSchema, response: { 200: recordResponse } } },
    async (req) => {
      const { id } = req.params as z.infer<typeof idParam>;
      const teamScope = teamScopeFor(req.user);
      // Always resolve `before` when team-scoped so an out-of-team agent is blocked
      // from mutating a ticket by id (update() itself is not team-scoped).
      const before = cfg.afterUpdate || cfg.transformUpdate || teamScope
        ? await cfg.repo.getById(req.orgId, id, teamScope)
        : undefined;
      if (teamScope && !before) throw notFound(`${cfg.path} ${id} not found`);
      let patch = req.body as Record<string, unknown>;
      if (cfg.transformUpdate && before) patch = cfg.transformUpdate(before, patch);
      const row = await cfg.repo.update(req.orgId, id, patch);
      if (!row) throw notFound(`${cfg.path} ${id} not found`);
      if (cfg.afterUpdate && before) await cfg.afterUpdate({ orgId: req.orgId, actorId: req.user.id }, before, row);
      return row;
    },
  );

  r.delete(
    `/${cfg.path}/:id`,
    { preHandler: requireRole(...writeRoles), schema: { params: idParam } },
    async (req, reply) => {
      const { id } = req.params as z.infer<typeof idParam>;
      const existing = await cfg.repo.getById(req.orgId, id, teamScopeFor(req.user));
      if (!existing) throw notFound(`${cfg.path} ${id} not found`);
      await cfg.repo.softDelete(req.orgId, id);
      reply.code(204);
    },
  );

  r.get(
    `/${cfg.path}`,
    { preHandler: requireRole(...readRoles), schema: { querystring: listQuery, response: { 200: pageResponse } } },
    async (req) => {
      const q = req.query as z.infer<typeof listQuery>;
      const filter = isRequester(req.user.role) ? ownFilter(req.user.id) : undefined;
      const scope = cfg.teamScoped ? { userId: req.user.id, role: req.user.role } : undefined;
      return cfg.repo.query(req.orgId, { limit: q.limit, cursor: q.cursor, filter }, scope);
    },
  );

  r.post(
    `/${cfg.path}/query`,
    { preHandler: requireRole(...readRoles), schema: { body: queryBody, response: { 200: pageResponse } } },
    async (req) => {
      const q = req.body as z.infer<typeof queryBody>;
      const filter = isRequester(req.user.role) ? ownFilter(req.user.id, q.filter as FilterNode | undefined) : q.filter;
      const scope = cfg.teamScoped ? { userId: req.user.id, role: req.user.role } : undefined;
      return cfg.repo.query(req.orgId, { filter, sort: q.sort, limit: q.limit, cursor: q.cursor }, scope);
    },
  );
}
