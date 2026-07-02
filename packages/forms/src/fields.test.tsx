// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useForm, FormProvider } from 'react-hook-form';
import type { FieldDef } from '@tessio/shared';
import { FieldInput } from './fields';

function Wrapper({ field }: { field: FieldDef }) {
  const methods = useForm();
  return (
    <FormProvider {...methods}>
      <FieldInput field={field} />
    </FormProvider>
  );
}

const base = { order: 0, required: false, width: 'full' as const };

describe('FieldInput', () => {
  it('renders a labelled text input', () => {
    render(<Wrapper field={{ ...base, key: 'name', label: 'Name', type: 'text' }} />);
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
  });

  it('renders a textarea for long-text', () => {
    render(<Wrapper field={{ ...base, key: 'desc', label: 'Description', type: 'long-text' }} />);
    expect(screen.getByLabelText('Description').tagName).toBe('TEXTAREA');
  });

  it('renders a checkbox for boolean', () => {
    render(<Wrapper field={{ ...base, key: 'ok', label: 'OK', type: 'boolean' }} />);
    expect(screen.getByLabelText('OK')).toHaveAttribute('type', 'checkbox');
  });

  it('renders a select with options from config', () => {
    render(
      <Wrapper
        field={{ ...base, key: 'cat', label: 'Category', type: 'select', config: { options: [{ value: 'hw', label: 'Hardware' }] } }}
      />,
    );
    expect(screen.getByLabelText('Category').tagName).toBe('SELECT');
    expect(screen.getByRole('option', { name: 'Hardware' })).toBeInTheDocument();
  });

  it('marks required fields with an asterisk', () => {
    render(<Wrapper field={{ ...base, key: 'name', label: 'Name', type: 'text', required: true }} />);
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('renders a checkbox per option for multiselect inside a labelled group', () => {
    render(
      <Wrapper
        field={{
          ...base,
          key: 'tags',
          label: 'Tags',
          type: 'multiselect',
          config: { options: [{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }] },
        }}
      />,
    );
    expect(screen.getByRole('group', { name: 'Tags' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Alpha' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Beta' })).toBeInTheDocument();
  });
});
