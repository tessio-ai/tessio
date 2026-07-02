// SPDX-License-Identifier: AGPL-3.0-only

import type { FastifyInstance } from 'fastify';
import fastifySwagger from '@fastify/swagger';
import { jsonSchemaTransform } from 'fastify-type-provider-zod';

/**
 * Register @fastify/swagger (Zod -> OpenAPI) and expose the generated document.
 * Must be registered before routes so their schemas are captured.
 */
export async function registerOpenApi(app: FastifyInstance): Promise<void> {
  await app.register(fastifySwagger, {
    openapi: {
      openapi: '3.1.0',
      info: { title: 'Tessio API', version: '1.0.0' },
    },
    transform: jsonSchemaTransform,
  });

  app.get('/openapi.json', async () => app.swagger());
}
