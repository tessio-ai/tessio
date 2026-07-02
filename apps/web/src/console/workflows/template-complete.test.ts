// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { activeTemplateQuery, applyCompletion, filterVariables } from './template-complete';
import type { VariableEntry } from './variables';

const v = (path: string): VariableEntry => ({ path, label: path, kind: 'ticket' });

describe('activeTemplateQuery', () => {
  it('detects a partial path inside an open expression', () => {
    const s = 'hello {{ ticket.st';
    expect(activeTemplateQuery(s, s.length)).toEqual({ start: 9, query: 'ticket.st' });
  });
  it('handles {{ with no spaces', () => {
    const s = 'x {{tick';
    expect(activeTemplateQuery(s, s.length)).toEqual({ start: 4, query: 'tick' });
  });
  it('returns null outside any expression', () => {
    expect(activeTemplateQuery('plain text', 5)).toBeNull();
  });
  it('returns null when the expression is already closed before the caret', () => {
    const s = '{{ ticket.id }} more';
    expect(activeTemplateQuery(s, s.length)).toBeNull();
  });
  it('returns null when the caret is at or before the opening {{', () => {
    expect(activeTemplateQuery('{{ ticket.id }}', 0)).toBeNull();
  });
});

describe('applyCompletion', () => {
  it('inserts the path and a closing }} when none follows', () => {
    const s = 'a {{ tick';
    const r = applyCompletion(s, s.length, { start: 5, query: 'tick' }, 'ticket.status');
    expect(r.value).toBe('a {{ ticket.status }}');
    expect(r.value.slice(0, r.caret)).toBe('a {{ ticket.status');
  });
  it('does not duplicate an existing closing }}', () => {
    const s = '{{ tick }}';
    const r = applyCompletion(s, 7, { start: 3, query: 'tick' }, 'ticket.status');
    expect(r.value).toBe('{{ ticket.status }}');
  });
});

describe('filterVariables', () => {
  const entries = [v('ticket.status'), v('ticket.priority'), v('nodes.http_1.output'), v('run.id')];
  it('prefix matches rank first, case-insensitive', () => {
    expect(filterVariables(entries, 'TICKET.ST')[0].path).toBe('ticket.status');
  });
  it('substring matches included', () => {
    expect(filterVariables(entries, 'output').map((e) => e.path)).toContain('nodes.http_1.output');
  });
  it('empty query returns all', () => {
    expect(filterVariables(entries, '')).toHaveLength(4);
  });
});
