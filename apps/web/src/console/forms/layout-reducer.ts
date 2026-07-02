// SPDX-License-Identifier: AGPL-3.0-only

import type { FormDefinition, FormFieldRef, FormSection } from '@tessio/shared';

let counter = 0;
const newId = () => `sec_${Date.now().toString(36)}_${(counter++).toString(36)}`;

const normalize = (sections: FormSection[]): FormSection[] => sections.map((s, i) => ({ ...s, order: i }));
const allKeys = (def: FormDefinition): Set<string> =>
  new Set(def.sections.flatMap((s) => s.fields.map((f) => f.fieldKey)));

export function addSection(def: FormDefinition, title: string): FormDefinition {
  return { sections: normalize([...def.sections, { id: newId(), title, order: def.sections.length, fields: [] }]) };
}

export function renameSection(def: FormDefinition, sectionId: string, title: string): FormDefinition {
  return { sections: def.sections.map((s) => (s.id === sectionId ? { ...s, title } : s)) };
}

export function removeSection(def: FormDefinition, sectionId: string): FormDefinition {
  return { sections: normalize(def.sections.filter((s) => s.id !== sectionId)) };
}

/** Add a field ref to a section (no-op if it's already placed in any section). */
export function addField(def: FormDefinition, sectionId: string, fieldKey: string): FormDefinition {
  if (allKeys(def).has(fieldKey)) return def;
  const ref: FormFieldRef = { fieldKey, width: 'full' };
  return { sections: def.sections.map((s) => (s.id === sectionId ? { ...s, fields: [...s.fields, ref] } : s)) };
}

export function removeField(def: FormDefinition, sectionId: string, fieldKey: string): FormDefinition {
  return {
    sections: def.sections.map((s) =>
      s.id === sectionId ? { ...s, fields: s.fields.filter((f) => f.fieldKey !== fieldKey) } : s,
    ),
  };
}

export function setFieldProps(def: FormDefinition, sectionId: string, fieldKey: string, patch: Partial<FormFieldRef>): FormDefinition {
  return {
    sections: def.sections.map((s) =>
      s.id === sectionId
        ? { ...s, fields: s.fields.map((f) => (f.fieldKey === fieldKey ? { ...f, ...patch } : f)) }
        : s,
    ),
  };
}

export function moveField(def: FormDefinition, fromSectionId: string, toSectionId: string, fromIndex: number, toIndex: number): FormDefinition {
  const sections = def.sections.map((s) => ({ ...s, fields: [...s.fields] }));
  const from = sections.find((s) => s.id === fromSectionId);
  const to = sections.find((s) => s.id === toSectionId);
  if (!from || !to) return def;
  const [moved] = from.fields.splice(fromIndex, 1);
  if (!moved) return def;
  to.fields.splice(toIndex, 0, moved);
  return { sections };
}

export function moveSection(def: FormDefinition, fromIndex: number, toIndex: number): FormDefinition {
  const sections = [...def.sections];
  const [moved] = sections.splice(fromIndex, 1);
  if (!moved) return def;
  sections.splice(toIndex, 0, moved);
  return { sections: normalize(sections) };
}

/** Field keys not yet placed in any section. */
export function availableKeys(def: FormDefinition, schemaFieldKeys: string[]): string[] {
  const placed = allKeys(def);
  return schemaFieldKeys.filter((k) => !placed.has(k));
}
