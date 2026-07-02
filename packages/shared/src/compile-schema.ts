// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod';
import type { FieldDef, SchemaDefinition } from './schema-definition';

function num(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

/** Compile one field definition to a Zod type (the value type for `data[field.key]`). */
export function compileFieldSchema(field: FieldDef): z.ZodTypeAny {
  const v = field.validation ?? {};

  switch (field.type) {
    case 'number': {
      let n = z.coerce.number();
      const min = num(v.min);
      const max = num(v.max);
      if (min !== undefined) n = n.min(min);
      if (max !== undefined) n = n.max(max);
      return field.required ? n : n.optional();
    }
    case 'boolean':
      // Checkboxes always submit a boolean; "required" adds no extra constraint.
      return field.required ? z.boolean() : z.boolean().optional();
    case 'multiselect': {
      let a = z.array(z.string());
      if (field.required) a = a.min(1, 'Required');
      return field.required ? a : a.optional();
    }
    default: {
      // All remaining types are string-valued: text, long-text, rich-text, date,
      // select, user-reference, record-reference, attachment.
      let s = z.string();
      const minLength = num(v.minLength);
      const maxLength = num(v.maxLength);
      if (minLength !== undefined) s = s.min(minLength);
      if (maxLength !== undefined) s = s.max(maxLength);
      if (field.required) s = s.min(1, 'Required');
      return field.required ? s : s.optional();
    }
  }
}

/** Compile a whole definition to a Zod object validating a `data` record. */
export function compileSchema(definition: SchemaDefinition): z.ZodObject<z.ZodRawShape> {
  const shape: z.ZodRawShape = {};
  for (const field of definition.fields) {
    shape[field.key] = compileFieldSchema(field);
  }
  return z.object(shape);
}
