// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod';
import { filterNode } from './filter';

/** Field types from spec section 4.3. `record-reference` is what creates edges. */
export const fieldType = z.enum([
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
]);
export type FieldType = z.infer<typeof fieldType>;

/** Layout width of a field within its section (spec 7.1). */
export const fieldWidth = z.enum(['full', 'half', 'third']);
export type FieldWidth = z.infer<typeof fieldWidth>;

/** A form section (spec 7.1). */
export const sectionDef = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  order: z.number().int().nonnegative(),
  description: z.string().optional(),
});
export type SectionDef = z.infer<typeof sectionDef>;

/** One field in a schema's ordered definition (spec 4.3 + 7.1 layout). */
export const fieldDef = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  type: fieldType,
  required: z.boolean().default(false),
  order: z.number().int().nonnegative(),
  default: z.unknown().optional(),
  validation: z.record(z.unknown()).optional(),
  config: z.record(z.unknown()).optional(),
  // Layout + conditional visibility (spec 7.1).
  section: z.string().optional(),
  width: fieldWidth.default('full'),
  visibleWhen: filterNode.optional(),
});
export type FieldDef = z.infer<typeof fieldDef>;

/** A record type's definition: ordered fields, optionally grouped into sections (spec 4.3 / 7.1). */
export const schemaDefinition = z.object({
  sections: z.array(sectionDef).optional(),
  fields: z.array(fieldDef),
  tagTemplate: z.string().optional(),
  nameTemplate: z.string().optional(),
});
export type SchemaDefinition = z.infer<typeof schemaDefinition>;
