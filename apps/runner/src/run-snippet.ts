// SPDX-License-Identifier: AGPL-3.0-only

import { getQuickJS } from 'quickjs-emscripten';

export interface SnippetResult {
  output: unknown;
}

/** Hard resource caps applied to every snippet regardless of caller input. */
const MEMORY_LIMIT_BYTES = 32 * 1024 * 1024;
const STACK_SIZE_BYTES = 1024 * 1024;

/**
 * Run a snippet body (using `return`) against a `ctx` object inside a QuickJS
 * WebAssembly isolate. The isolate is a real security boundary: the guest has no
 * access to `process`, `require`, `fetch`, the filesystem, or any host object —
 * only plain ECMAScript and the injected `ctx`. Wall-clock time, heap, and stack
 * are all bounded so a hostile or runaway snippet cannot hang or exhaust the host.
 *
 * `ctx` is injected by serializing it to a JSON literal (it is plain data built by
 * the worker), so there is no marshalling of host functions into the guest.
 */
export async function runSnippet(code: string, ctx: unknown, timeoutMs = 1000): Promise<SnippetResult> {
  const QuickJS = await getQuickJS();
  const vm = QuickJS.newContext();
  vm.runtime.setMemoryLimit(MEMORY_LIMIT_BYTES);
  vm.runtime.setMaxStackSize(STACK_SIZE_BYTES);
  const deadline = Date.now() + timeoutMs;
  // Called periodically by the interpreter; returning true aborts execution.
  vm.runtime.setInterruptHandler(() => Date.now() > deadline);

  try {
    // JSON.stringify yields a literal that is also a valid JS expression and cannot
    // break out of the wrapper (quotes/backslashes are escaped). `ctx` defaults to {}.
    const ctxLiteral = JSON.stringify(ctx ?? {});
    const wrapped = `(function () {
  "use strict";
  const ctx = ${ctxLiteral};
  return (function () {
${code}
  })();
})();`;
    const result = vm.evalCode(wrapped);
    if (result.error) {
      const dumped = vm.dump(result.error);
      result.error.dispose();
      throw new Error(formatGuestError(dumped));
    }
    const output = vm.dump(result.value);
    result.value.dispose();
    return { output };
  } finally {
    // Disposing the context also tears down its runtime and frees the WASM heap.
    vm.dispose();
  }
}

/** Turn a dumped guest exception into a single client-facing message string. */
function formatGuestError(dumped: unknown): string {
  if (dumped && typeof dumped === 'object') {
    const e = dumped as { name?: string; message?: string };
    if (e.message) return e.name ? `${e.name}: ${e.message}` : e.message;
  }
  return typeof dumped === 'string' ? dumped : 'Script error';
}
