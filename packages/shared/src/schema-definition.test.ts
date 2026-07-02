// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { schemaDefinition, fieldType } from './schema-definition';

describe('schemaDefinition', () => {
  it('parses a valid definition and defaults required to false', () => {
    const parsed = schemaDefinition.parse({
      fields: [{ key: 'title', label: 'Title', type: 'text', order: 0 }],
    });
    expect(parsed.fields[0].required).toBe(false);
  });

  it('rejects an unknown field type', () => {
    expect(() =>
      schemaDefinition.parse({
        fields: [{ key: 'x', label: 'X', type: 'bogus', order: 0 }],
      }),
    ).toThrow();
  });

  it('exposes the full field-type enum from spec 4.3', () => {
    const expected = [
      'text',
      'long-text',
      'rich-text',
      'number',
      'boolean',
      'date',
      'select',
      'multiselect',
      'user-reference',
      'record-reference',
      'attachment',
    ] as const;
    expect(fieldType.options).toEqual(expect.arrayContaining([...expected]));
    expect(fieldType.options).toHaveLength(expected.length);
  });

  it('accepts sections and per-field layout + visibleWhen', () => {
    const parsed = schemaDefinition.parse({
      sections: [{ id: 'main', title: 'Main', order: 0 }],
      fields: [
        { key: 'category', label: 'Category', type: 'select', order: 0, section: 'main', width: 'half' },
        {
          key: 'assetTag',
          label: 'Asset',
          type: 'text',
          order: 1,
          section: 'main',
          width: 'full',
          visibleWhen: { field: 'category', op: 'eq', value: 'hardware' },
        },
      ],
    });
    expect(parsed.sections?.[0].title).toBe('Main');
    expect(parsed.fields[0].width).toBe('half');
    expect(parsed.fields[1].visibleWhen).toEqual({ field: 'category', op: 'eq', value: 'hardware' });
  });

  it('defaults field width to full', () => {
    const parsed = schemaDefinition.parse({ fields: [{ key: 'x', label: 'X', type: 'text', order: 0 }] });
    expect(parsed.fields[0].width).toBe('full');
  });

  it('rejects an unknown field width', () => {
    expect(() =>
      schemaDefinition.parse({ fields: [{ key: 'x', label: 'X', type: 'text', order: 0, width: 'quarter' }] }),
    ).toThrow();
  });
});

describe('schemaDefinition naming templates', () => {
  it('round-trips tagTemplate + nameTemplate', () => {
    const d = schemaDefinition.parse({ fields: [], tagTemplate: 'ACME-{seq:0000}', nameTemplate: '{model}' });
    expect(d.tagTemplate).toBe('ACME-{seq:0000}');
    expect(d.nameTemplate).toBe('{model}');
  });
  it('leaves them undefined when omitted', () => {
    const d = schemaDefinition.parse({ fields: [] });
    expect(d.tagTemplate).toBeUndefined();
    expect(d.nameTemplate).toBeUndefined();
  });
});
