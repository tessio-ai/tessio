// SPDX-License-Identifier: AGPL-3.0-only

import type { SchemaDefinition } from './schema-definition';
import type { FormDefinition } from './forms';

export type FormValidationResult = { ok: true } | { ok: false; errors: string[] };

/**
 * A form must reference only real schema fields, and must collect every
 * schema-required field that has no default. `requiredAtIntake` may only tighten.
 */
export function validateFormAgainstSchema(def: FormDefinition, schema: SchemaDefinition): FormValidationResult {
  const errors: string[] = [];
  const schemaByKey = new Map(schema.fields.map((f) => [f.key, f]));
  const referenced = new Set<string>();

  for (const section of def.sections) {
    for (const ref of section.fields) {
      referenced.add(ref.fieldKey);
      if (!schemaByKey.has(ref.fieldKey)) {
        errors.push(`field "${ref.fieldKey}" does not exist on the target schema`);
      }
    }
  }

  for (const field of schema.fields) {
    const hasDefault = field.default !== undefined && field.default !== null;
    if (field.required && !hasDefault && !referenced.has(field.key)) {
      errors.push(`required field "${field.key}" is not collected by the form`);
    }
  }

  return errors.length ? { ok: false, errors } : { ok: true };
}
