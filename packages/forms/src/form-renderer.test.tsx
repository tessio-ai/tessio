// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SchemaDefinition } from '@tessio/shared';
import { FormRenderer } from './form-renderer';

const def: SchemaDefinition = {
  sections: [{ id: 'main', title: 'Main', order: 0 }],
  fields: [
    { key: 'title', label: 'Title', type: 'text', order: 0, required: true, width: 'full', section: 'main' },
    { key: 'notes', label: 'Notes', type: 'long-text', order: 1, required: false, width: 'full', section: 'main' },
  ],
};

describe('FormRenderer', () => {
  it('renders the section title and fields', () => {
    render(<FormRenderer definition={def} onSubmit={() => {}} />);
    expect(screen.getByText('Main')).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toBeInTheDocument();
    expect(screen.getByLabelText('Notes')).toBeInTheDocument();
  });

  it('blocks submit and shows an error when a required field is empty', async () => {
    const onSubmit = vi.fn();
    render(<FormRenderer definition={def} onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(await screen.findByText('Required')).toBeInTheDocument();
  });

  it('submits the typed values when valid', async () => {
    const onSubmit = vi.fn();
    render(<FormRenderer definition={def} onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText('Title'), 'Hello');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSubmit).toHaveBeenCalledWith({ title: 'Hello', notes: '' });
  });

  it('renders default values', () => {
    render(<FormRenderer definition={def} value={{ title: 'Preset' }} onSubmit={() => {}} />);
    expect(screen.getByLabelText('Title')).toHaveValue('Preset');
  });

  it('reports live field values to the callback', async () => {
    const onValuesChange = vi.fn();
    render(<FormRenderer definition={def} onSubmit={() => {}} onValuesChange={onValuesChange} />);
    await userEvent.type(screen.getByLabelText('Title'), 'XPS');
    expect(onValuesChange).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'XPS' }));
  });
});
