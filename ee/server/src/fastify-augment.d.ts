// SPDX-License-Identifier: LicenseRef-Tessio-Commercial
// Mirror of the core auth-context request augmentation (apps/api/src/auth/roles.ts).
// ee/ compiles independently and cannot import that core .d.ts augmentation, so we
// re-declare the subset enterprise routes rely on. At runtime these fields are
// decorated by the core auth-context preHandler before any ee route runs.
import type {} from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    orgId: string;
    user: { id: string; orgId: string; role: 'admin' | 'agent' | 'requester'; email: string };
  }
}
