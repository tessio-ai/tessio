// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { compileSchema } from './compile-schema';
import type { SchemaDefinition } from './schema-definition';

const def: SchemaDefinition = {
  fields: [
    { key: 'title', label: 'Title', type: 'text', order: 0, required: true, width: 'full' },
    { key: 'count', label: 'Count', type: 'number', order: 1, required: false, width: 'full' },
    { key: 'agree', label: 'Agree', type: 'boolean', order: 2, required: false, width: 'full' },
    { key: 'tags', label: 'Tags', type: 'multiselect', order: 3, required: false, width: 'full' },
  ],
};

describe('compileSchema', () => {
  it('accepts a valid record', () => {
    const schema = compileSchema(def);
    const parsed = schema.parse({ title: 'Hello', count: '5', agree: true, tags: ['a'] });
    expect(parsed).toEqual({ title: 'Hello', count: 5, agree: true, tags: ['a'] });
  });

  it('rejects a missing required field', () => {
    const schema = compileSchema(def);
    expect(() => schema.parse({ count: 1 })).toThrow();
  });

  it('rejects an empty required string', () => {
    const schema = compileSchema(def);
    expect(() => schema.parse({ title: '' })).toThrow();
  });

  it('allows optional fields to be omitted', () => {
    const schema = compileSchema(def);
    expect(() => schema.parse({ title: 'ok' })).not.toThrow();
  });

  it('enforces string maxLength from validation config', () => {
    const schema = compileSchema({
      fields: [{ key: 'code', label: 'Code', type: 'text', order: 0, required: true, width: 'full', validation: { maxLength: 3 } }],
    });
    expect(() => schema.parse({ code: 'toolong' })).toThrow();
  });
});
