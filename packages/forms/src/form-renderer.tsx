// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useMemo } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { compileSchema, evaluateFilter, type SchemaDefinition, type FieldDef, type SectionDef } from '@tessio/shared';
import { FieldInput } from './fields';
import { widthToColSpan } from './layout';

export interface FormRendererProps {
  definition: SchemaDefinition;
  value?: Record<string, unknown>;
  onSubmit: (values: Record<string, unknown>) => void;
  submitLabel?: string;
  onValuesChange?: (values: Record<string, unknown>) => void;
}

/** Implicit catch-all section for fields with no `section` set. */
const UNSECTIONED: SectionDef = { id: '__none__', title: '', order: Number.MAX_SAFE_INTEGER };

function groupBySection(definition: SchemaDefinition): { section: SectionDef; fields: FieldDef[] }[] {
  const sections = [...(definition.sections ?? [])].sort((a, b) => a.order - b.order);
  const all = [...sections, UNSECTIONED];
  return all
    .map((section) => ({
      section,
      fields: definition.fields
        .filter((f) => (f.section ?? UNSECTIONED.id) === section.id)
        .sort((a, b) => a.order - b.order),
    }))
    .filter((g) => g.fields.length > 0);
}

/**
 * Schema-driven form. Compiles the definition to a Zod validator, lays fields out
 * by section + width, evaluates each field's `visibleWhen` against the live values
 * to show/hide it, and submits the typed `data` record.
 */
export function FormRenderer({ definition, value, onSubmit, onValuesChange, submitLabel = 'Save' }: FormRendererProps) {
  const resolver = useMemo(() => zodResolver(compileSchema(definition)), [definition]);
  const methods = useForm({
    resolver,
    defaultValues: value ?? {},
  });

  useEffect(() => {
    if (!onValuesChange) return;
    onValuesChange(methods.getValues() as Record<string, unknown>);
    const sub = methods.watch((v) => onValuesChange(v as Record<string, unknown>));
    return () => sub.unsubscribe();
  }, [methods, onValuesChange]);

  const values = methods.watch();
  const baseGroups = useMemo(() => groupBySection(definition), [definition]);
  const groups = baseGroups
    .map((group) => ({
      section: group.section,
      fields: group.fields.filter(
        (field) => !field.visibleWhen || evaluateFilter(field.visibleWhen, values as Record<string, unknown>),
      ),
    }))
    .filter((group) => group.fields.length > 0);

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit((v) => onSubmit(v as Record<string, unknown>))} className="space-y-6">
        {groups.map((group) => (
          <fieldset key={group.section.id} className="space-y-3">
            {group.section.title ? (
              <legend className="text-lg font-semibold">{group.section.title}</legend>
            ) : null}
            <div className="grid grid-cols-6 gap-4">
              {group.fields.map((field) => (
                <div key={field.key} className={widthToColSpan(field.width)}>
                  <FieldInput field={field} />
                </div>
              ))}
            </div>
          </fieldset>
        ))}
        <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
          {submitLabel}
        </button>
      </form>
    </FormProvider>
  );
}
