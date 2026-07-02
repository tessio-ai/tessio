// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Replace `{token}` and `{token:0000}` in a template. Tokens resolve against `values`
 * (string-coerced). The `:PAD` suffix is a run of digits whose LENGTH is the zero-pad
 * width for a numeric value (the digits themselves are ignored — `{seq:0000}` and
 * `{seq:0001}` both pad to 4). Unknown/nullish tokens resolve to ''. The result is trimmed.
 */
export function resolveTemplate(template: string, values: Record<string, unknown>): string {
  return template
    .replace(/\{([a-zA-Z0-9_]+)(?::(\d+))?\}/g, (_m, key: string, pad?: string) => {
      const raw = values[key];
      if (raw === undefined || raw === null) return '';
      if (pad) {
        const n = typeof raw === 'number' ? raw : Number(raw);
        if (Number.isFinite(n)) return String(Math.trunc(n)).padStart(pad.length, '0');
      }
      return String(raw);
    })
    .trim();
}
