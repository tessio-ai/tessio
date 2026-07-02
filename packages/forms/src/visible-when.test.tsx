// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SchemaDefinition } from '@tessio/shared';
import { FormRenderer } from './form-renderer';

const def: SchemaDefinition = {
  fields: [
    {
      key: 'category',
      label: 'Category',
      type: 'select',
      order: 0,
      required: false,
      width: 'full',
      config: { options: [{ value: 'hardware', label: 'Hardware' }, { value: 'software', label: 'Software' }] },
    },
    {
      key: 'assetTag',
      label: 'Asset Tag',
      type: 'text',
      order: 1,
      required: false,
      width: 'full',
      visibleWhen: { field: 'category', op: 'eq', value: 'hardware' },
    },
  ],
};

describe('FormRenderer visibleWhen', () => {
  it('hides a field until its condition is met, then shows it', async () => {
    render(<FormRenderer definition={def} onSubmit={() => {}} />);
    expect(screen.queryByLabelText('Asset Tag')).toBeNull();
    await userEvent.selectOptions(screen.getByLabelText('Category'), 'hardware');
    expect(await screen.findByLabelText('Asset Tag')).toBeInTheDocument();
  });
});
