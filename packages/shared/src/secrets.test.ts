// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { interpolateDeep } from './interpolate';
import { SECRET_NAME_RE, redactedSecretsScope, resolveSecrets, collectSecretRefs } from './secrets';
import type { WorkflowGraph } from './workflow';

describe('SECRET_NAME_RE', () => {
  it('accepts lowercase/digits/underscore only', () => {
    expect(SECRET_NAME_RE.test('stripe_key1')).toBe(true);
    expect(SECRET_NAME_RE.test('Stripe-Key')).toBe(false);
    expect(SECRET_NAME_RE.test('')).toBe(false);
  });
});

describe('redactedSecretsScope', () => {
  it('keeps the placeholder literal through interpolateDeep', () => {
    const scope = { ticket: { id: 't1' }, secrets: redactedSecretsScope() };
    const out = interpolateDeep({ auth: 'Bearer {{ secrets.stripe_key }}', who: '{{ ticket.id }}' }, scope);
    expect(out).toEqual({ auth: 'Bearer {{ secrets.stripe_key }}', who: 't1' });
  });
});

describe('resolveSecrets', () => {
  it('replaces placeholders with real values (single + embedded)', () => {
    const input = { a: '{{ secrets.k }}', b: 'Bearer {{ secrets.k }}' };
    expect(resolveSecrets(input, { k: 'sk_live_1' })).toEqual({ a: 'sk_live_1', b: 'Bearer sk_live_1' });
  });
  it('throws on a referenced-but-undefined secret', () => {
    expect(() => resolveSecrets({ a: '{{ secrets.missing }}' }, {})).toThrow(/secret "missing" is not defined/);
  });
  it('leaves non-secret text untouched', () => {
    expect(resolveSecrets({ a: 'plain' }, {})).toEqual({ a: 'plain' });
  });
});

describe('collectSecretRefs', () => {
  it('gathers names from templates and http auth', () => {
    const graph = {
      nodes: [
        { id: 'c', type: 'add_comment', position: { x: 0, y: 0 }, config: { body: 'hi {{ secrets.a }}' } },
        { id: 'h', type: 'http_request', position: { x: 0, y: 0 }, config: { method: 'GET', url: 'x', auth: { type: 'bearer', secret: 'b' } } },
      ],
      edges: [],
    } as unknown as WorkflowGraph;
    expect(collectSecretRefs(graph).sort()).toEqual(['a', 'b']);
  });
});
