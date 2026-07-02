// SPDX-License-Identifier: AGPL-3.0-only

import type { VariableEntry } from './variables';

/** If the caret sits inside an unclosed `{{ … }}`, return the partial path + its start index. */
export function activeTemplateQuery(value: string, caret: number): { start: number; query: string } | null {
  const open = value.lastIndexOf('{{', caret - 1);
  if (open === -1) return null;
  if (open >= caret) return null;
  const close = value.indexOf('}}', open);
  if (close !== -1 && close < caret) return null; // already closed before the caret
  // Walk past `{{` and optional whitespace to the start of the path token.
  let i = open + 2;
  while (i < caret && value[i] === ' ') i += 1;
  const token = value.slice(i, caret);
  if (token && !/^[A-Za-z0-9_.]*$/.test(token)) return null;
  return { start: i, query: token };
}

/** Replace the active query span with `path`, adding a closing ` }}` if one doesn't already follow. */
export function applyCompletion(
  value: string,
  caret: number,
  active: { start: number; query: string },
  path: string,
): { value: string; caret: number } {
  const before = value.slice(0, active.start);
  const after = value.slice(caret);
  const followsClose = /^\s*}}/.test(after);
  const insert = followsClose ? path : `${path} }}`;
  const newValue = before + insert + after;
  const caretPos = (before + path).length;
  return { value: newValue, caret: caretPos };
}

/** Filter entries by query: prefix matches first, then substring; case-insensitive; capped. */
export function filterVariables(entries: VariableEntry[], query: string): VariableEntry[] {
  const q = query.toLowerCase();
  if (!q) return entries.slice(0, 50);
  const prefix: VariableEntry[] = [];
  const sub: VariableEntry[] = [];
  for (const e of entries) {
    const p = e.path.toLowerCase();
    if (p.startsWith(q)) prefix.push(e);
    else if (p.includes(q)) sub.push(e);
  }
  return [...prefix, ...sub].slice(0, 50);
}
