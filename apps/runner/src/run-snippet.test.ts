// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { runSnippet } from './run-snippet';

describe('runSnippet', () => {
  it('returns the value the snippet returns', async () => {
    expect((await runSnippet('return ctx.a + ctx.b;', { a: 1, b: 2 })).output).toBe(3);
  });

  it('passes through structured ctx data', async () => {
    const out = await runSnippet('return ctx.ticket.tags.join("-");', { ticket: { tags: ['a', 'b'] } });
    expect(out.output).toBe('a-b');
  });

  it('enforces the timeout on a runaway loop', async () => {
    await expect(runSnippet('while (true) {}', {}, 50)).rejects.toThrow();
  });

  it('surfaces a thrown error message', async () => {
    await expect(runSnippet('throw new Error("boom");', {})).rejects.toThrow(/boom/);
  });

  it('has no access to host globals (process/require/fetch)', async () => {
    expect((await runSnippet('return typeof process;', {})).output).toBe('undefined');
    expect((await runSnippet('return typeof require;', {})).output).toBe('undefined');
    expect((await runSnippet('return typeof fetch;', {})).output).toBe('undefined');
    expect((await runSnippet('return typeof globalThis.process;', {})).output).toBe('undefined');
  });

  it('cannot escape via the Function constructor to reach the host', async () => {
    // The classic node:vm escape — building a fn via the constructor must still run
    // in the guest global, where the host process is invisible.
    const out = await runSnippet('return (function () {}).constructor("return typeof process")();', {});
    expect(out.output).toBe('undefined');
  });

  it('cannot mutate ctx back into the host', async () => {
    const ctx = { n: 1 };
    await runSnippet('ctx.n = 999; return ctx.n;', ctx);
    expect(ctx.n).toBe(1); // host object untouched — ctx was serialized in
  });
});
