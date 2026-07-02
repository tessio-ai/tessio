// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, describe, it, expect } from 'vitest';
import { buildApp } from './app';

afterEach(() => {
  delete process.env.RUNNER_TOKEN;
});

describe('runner app', () => {
  it('GET /health returns ok', async () => {
    const app = buildApp();
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
    await app.close();
  });

  it('POST /run executes a snippet', async () => {
    const app = buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/run',
      payload: { code: 'return ctx.n * 2;', ctx: { n: 21 } },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ output: 42 });
    await app.close();
  });

  it('POST /run returns 422 with the error for a throwing snippet', async () => {
    const app = buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/run',
      payload: { code: 'throw new Error("nope");' },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error).toContain('nope');
    await app.close();
  });

  it('rejects /run without the bearer token when RUNNER_TOKEN is set', async () => {
    process.env.RUNNER_TOKEN = 'secret-token';
    const app = buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/run',
      payload: { code: 'return 1;' },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('accepts /run with the correct bearer token', async () => {
    process.env.RUNNER_TOKEN = 'secret-token';
    const app = buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/run',
      headers: { authorization: 'Bearer secret-token' },
      payload: { code: 'return 7;', ctx: {} },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ output: 7 });
    await app.close();
  });

  it('rejects /run with a wrong bearer token', async () => {
    process.env.RUNNER_TOKEN = 'secret-token';
    const app = buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/run',
      headers: { authorization: 'Bearer wrong' },
      payload: { code: 'return 1;' },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });
});
