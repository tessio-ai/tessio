// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { validateFormAgainstSchema } from './validate-form';
import type { SchemaDefinition } from './schema-definition';
import type { FormDefinition } from './forms';

const schema: SchemaDefinition = {
  fields: [
    { key: 'title', label: 'Title', type: 'text', required: true, order: 0, width: 'full' },
    { key: 'urgency', label: 'Urgency', type: 'select', required: false, order: 1, width: 'full' },
  ],
};
const form = (fields: { fieldKey: string; requiredAtIntake?: boolean }[]): FormDefinition => ({
  sections: [{ id: 's1', title: 'S', order: 0, fields: fields.map((f) => ({ ...f, width: 'full' as const })) }],
});

describe('validateFormAgainstSchema', () => {
  it('accepts a form that covers required fields and references real fields', () => {
    expect(validateFormAgainstSchema(form([{ fieldKey: 'title' }, { fieldKey: 'urgency' }]), schema)).toEqual({ ok: true });
  });

  it('rejects a dangling field reference', () => {
    const r = validateFormAgainstSchema(form([{ fieldKey: 'title' }, { fieldKey: 'nope' }]), schema);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/nope/);
  });

  it('rejects a form that omits a required schema field with no default', () => {
    const r = validateFormAgainstSchema(form([{ fieldKey: 'urgency' }]), schema);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/title/);
  });

  it('allows requiredAtIntake to tighten an optional field', () => {
    expect(validateFormAgainstSchema(form([{ fieldKey: 'title' }, { fieldKey: 'urgency', requiredAtIntake: true }]), schema)).toEqual({ ok: true });
  });

  it('treats a required field with a default as covered even if omitted', () => {
    const withDefault: SchemaDefinition = { fields: [{ key: 'title', label: 'T', type: 'text', required: true, order: 0, width: 'full', default: 'x' }] };
    expect(validateFormAgainstSchema(form([]), withDefault)).toEqual({ ok: true });
  });
});
