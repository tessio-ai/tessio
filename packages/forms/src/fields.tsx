// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import { useFormContext } from 'react-hook-form';
import { cn } from '@tessio/ui';
import type { FieldDef } from '@tessio/shared';

interface OptionConfig {
  value: string;
  label: string;
}

function options(field: FieldDef): OptionConfig[] {
  const raw = (field.config?.options ?? []) as unknown;
  if (!Array.isArray(raw)) return [];
  return raw.map((o) =>
    typeof o === 'string' ? { value: o, label: o } : (o as OptionConfig),
  );
}

const inputClass = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm';

function FieldShell({
  field,
  children,
  group = false,
}: {
  field: FieldDef;
  children: ReactNode;
  /** Use a fieldset/legend (for multi-input groups like multiselect) instead of a label. */
  group?: boolean;
}) {
  const {
    formState: { errors },
  } = useFormContext();
  const error = errors[field.key];
  const heading = (
    <>
      {field.label}
      {field.required ? <span className="text-red-500" aria-hidden="true"> *</span> : null}
    </>
  );
  const errorNode = error ? (
    <span className="text-xs text-red-500">{String(error.message ?? 'Invalid')}</span>
  ) : null;

  if (group) {
    // Multi-input groups have no single control to point a `for` at, so use a
    // fieldset/legend — the accessible pattern for a labelled group of inputs.
    return (
      <fieldset className="flex flex-col gap-1">
        <legend className="text-sm font-medium">{heading}</legend>
        {children}
        {errorNode}
      </fieldset>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={field.key} className="text-sm font-medium">
        {heading}
      </label>
      {children}
      {errorNode}
    </div>
  );
}

/** Render the input element for one field, wired to react-hook-form via context. */
export function FieldInput({ field }: { field: FieldDef }) {
  const { register } = useFormContext();

  if (field.type === 'long-text' || field.type === 'rich-text') {
    return (
      <FieldShell field={field}>
        <textarea id={field.key} aria-label={field.label} className={cn(inputClass, 'min-h-24')} {...register(field.key)} />
      </FieldShell>
    );
  }

  if (field.type === 'boolean') {
    return (
      <FieldShell field={field}>
        <input id={field.key} aria-label={field.label} type="checkbox" className="h-4 w-4" {...register(field.key)} />
      </FieldShell>
    );
  }

  if (field.type === 'select') {
    return (
      <FieldShell field={field}>
        <select id={field.key} aria-label={field.label} className={inputClass} {...register(field.key)}>
          <option value="" />
          {options(field).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </FieldShell>
    );
  }

  if (field.type === 'multiselect') {
    return (
      <FieldShell field={field} group>
        <div className="flex flex-col gap-1">
          {options(field).map((o) => (
            <label key={o.value} className="flex items-center gap-2 text-sm">
              <input type="checkbox" value={o.value} {...register(field.key)} />
              {o.label}
            </label>
          ))}
        </div>
      </FieldShell>
    );
  }

  const inputType = field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text';
  return (
    <FieldShell field={field}>
      <input id={field.key} aria-label={field.label} type={inputType} className={inputClass} {...register(field.key)} />
    </FieldShell>
  );
}
