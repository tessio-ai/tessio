// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { getPath, interpolate, interpolateDeep } from './interpolate';

describe('getPath', () => {
  it('resolves nested dot paths', () => {
    expect(getPath({ a: { b: { c: 3 } } }, 'a.b.c')).toBe(3);
    expect(getPath({ a: 1 }, 'a')).toBe(1);
  });

  it('is null-safe on missing segments', () => {
    expect(getPath({ a: {} }, 'a.b.c')).toBeUndefined();
    expect(getPath({}, 'x')).toBeUndefined();
    expect(getPath({ a: null }, 'a.b')).toBeUndefined();
  });
});

describe('interpolate', () => {
  const scope = {
    ticket: { status: 'open', data: { count: 3, tags: ['a', 'b'] } },
    nodes: { http: { output: { ok: true } } },
  };

  it('preserves the raw type when the template is a single expression', () => {
    expect(interpolate('{{ ticket.data.count }}', scope)).toBe(3);
    expect(interpolate('{{ nodes.http.output }}', scope)).toEqual({ ok: true });
    expect(interpolate('{{ ticket.data.tags }}', scope)).toEqual(['a', 'b']);
  });

  it('returns undefined for a single expression on a missing path', () => {
    expect(interpolate('{{ ticket.nope }}', scope)).toBeUndefined();
  });

  it('stringifies inside mixed templates', () => {
    expect(interpolate('status={{ ticket.status }} n={{ ticket.data.count }}', scope)).toBe('status=open n=3');
    expect(interpolate('out: {{ nodes.http.output }}', scope)).toBe('out: {"ok":true}');
  });

  it('renders missing paths as empty string inside mixed templates', () => {
    expect(interpolate('x={{ ticket.nope }}!', scope)).toBe('x=!');
  });

  it('leaves non-template strings untouched', () => {
    expect(interpolate('plain text', scope)).toBe('plain text');
    expect(interpolate('a { not } template', scope)).toBe('a { not } template');
  });

  it('passes non-string values through', () => {
    expect(interpolate(7 as unknown as string, scope)).toBe(7);
  });
});

describe('interpolateDeep', () => {
  const scope = { ticket: { id: 't1', priority: 'high' } };

  it('walks objects and arrays', () => {
    expect(
      interpolateDeep(
        { set: { priority: '{{ ticket.priority }}' }, list: ['{{ ticket.id }}', 'x'], n: 1, keep: null },
        scope,
      ),
    ).toEqual({ set: { priority: 'high' }, list: ['t1', 'x'], n: 1, keep: null });
  });
});
