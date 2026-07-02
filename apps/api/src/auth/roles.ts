// SPDX-License-Identifier: AGPL-3.0-only

export type Role = 'admin' | 'agent' | 'requester';

export interface AuthUser {
  id: string;
  orgId: string;
  role: Role;
  email: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    orgId: string;
    user: AuthUser;
  }
}
