// SPDX-License-Identifier: AGPL-3.0-only

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

/** A problem+json (RFC 9457-style) API error. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public title: string,
    public detail?: string,
    /** Problem+json extension members merged into the response body (e.g. validation `errors`). */
    public extensions?: Record<string, unknown>,
  ) {
    super(title);
  }
}

export const badRequest = (detail?: string) => new ApiError(400, 'Bad Request', detail);
export const notFound = (detail?: string) => new ApiError(404, 'Not Found', detail);
export const conflict = (detail?: string) => new ApiError(409, 'Conflict', detail);
export const payloadTooLarge = (detail?: string) => new ApiError(413, 'Payload Too Large', detail);
export const unsupportedMediaType = (detail?: string) => new ApiError(415, 'Unsupported Media Type', detail);

/** Register a handler that renders all errors as application/problem+json. */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((err: unknown, req: FastifyRequest, reply: FastifyReply) => {
    if (err instanceof ApiError) {
      reply
        .code(err.status)
        .type('application/problem+json')
        .send({ type: 'about:blank', title: err.title, status: err.status, detail: err.detail, ...err.extensions });
      return;
    }
    // Zod validation errors from fastify-type-provider-zod carry statusCode 400.
    const statusCode = (err as { statusCode?: number }).statusCode ?? 500;
    if (statusCode >= 500) {
      // Log the real error server-side; never leak internal details to the client.
      req.log.error({ err }, 'unhandled error');
      reply
        .code(statusCode)
        .type('application/problem+json')
        .send({ type: 'about:blank', title: 'Internal Server Error', status: statusCode, detail: 'An unexpected error occurred.' });
      return;
    }
    // 4xx (e.g. zod validation): the message is a safe, client-facing detail.
    reply
      .code(statusCode)
      .type('application/problem+json')
      .send({ type: 'about:blank', title: statusCode === 400 ? 'Bad Request' : 'Error', status: statusCode, detail: (err as { message?: string }).message });
  });

  app.setNotFoundHandler((_req, reply) => {
    reply
      .code(404)
      .type('application/problem+json')
      .send({ type: 'about:blank', title: 'Not Found', status: 404 });
  });
}
