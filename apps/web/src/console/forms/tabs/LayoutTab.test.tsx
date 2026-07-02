// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LayoutTab } from './LayoutTab';
import type { FormDefinition, SchemaDefinition } from '@tessio/shared';

beforeEach(() => vi.restoreAllMocks());
afterEach(() => vi.restoreAllMocks());

const schemaDef: SchemaDefinition = { fields: [
  { key: 'title', label: 'Title', type: 'text', required: true, order: 0, width: 'full' },
  { key: 'urgency', label: 'Urgency', type: 'select', required: false, order: 1, width: 'full' },
] };
const def: FormDefinition = { sections: [{ id: 's1', title: 'Details', order: 0, fields: [{ fieldKey: 'title', width: 'full' }] }] };

describe('LayoutTab', () => {
  it('shows placed fields and available (unplaced) fields', () => {
    render(<LayoutTab definition={def} schemaDefinition={schemaDef} onChange={vi.fn()} />);
    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText(/urgency/i)).toBeInTheDocument();
  });

  it('adding an available field calls onChange with the placed field', async () => {
    const onChange = vi.fn();
    render(<LayoutTab definition={def} schemaDefinition={schemaDef} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: /add urgency/i }));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const next = onChange.mock.calls.at(-1)![0] as FormDefinition;
    expect(next.sections[0].fields.map((f) => f.fieldKey)).toContain('urgency');
  });

  it('changing a field width calls onChange', async () => {
    const onChange = vi.fn();
    render(<LayoutTab definition={def} schemaDefinition={schemaDef} onChange={onChange} />);
    await userEvent.selectOptions(screen.getByLabelText(/width for title/i), 'half');
    const next = onChange.mock.calls.at(-1)![0] as FormDefinition;
    expect(next.sections[0].fields[0].width).toBe('half');
  });
});
