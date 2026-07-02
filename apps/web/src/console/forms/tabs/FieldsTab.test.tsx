// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { FieldsTab } from './FieldsTab';
import * as schemasApi from '../../../api/schemas';
import type { SchemaDefinition } from '@tessio/shared';

function wrap(node: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={qc}>{node}</QueryClientProvider>;
}
beforeEach(() => vi.restoreAllMocks());
afterEach(() => vi.restoreAllMocks());

const schemaDef: SchemaDefinition = { fields: [{ key: 'title', label: 'Title', type: 'text', required: true, order: 0, width: 'full' }] };

describe('FieldsTab', () => {
  it('lists the schema fields', () => {
    render(wrap(<FieldsTab schemaId="s1" definition={schemaDef} />));
    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('text')).toBeInTheDocument();
  });

  it('adds a field via the editor and saves the new definition', async () => {
    const update = vi.spyOn(schemasApi, 'updateSchema').mockResolvedValue({ id: 's1', version: 2 } as never);
    render(wrap(<FieldsTab schemaId="s1" definition={schemaDef} />));
    await userEvent.click(screen.getByRole('button', { name: /add field/i }));
    await userEvent.type(screen.getByLabelText(/field label/i), 'Urgency');
    await userEvent.click(screen.getByRole('button', { name: /^save field$/i }));
    await waitFor(() => expect(update).toHaveBeenCalled());
    const sentDef = (update.mock.calls[0][1] as { definition: SchemaDefinition }).definition;
    expect(sentDef.fields.map((f) => f.label)).toContain('Urgency');
  });

  it('surfaces a 409 destructive-guard error inline', async () => {
    vi.spyOn(schemasApi, 'updateSchema').mockRejectedValue(Object.assign(new Error('x'), { status: 409, detail: 'field "title" is used by form "Report"' }));
    render(wrap(<FieldsTab schemaId="s1" definition={schemaDef} />));
    await userEvent.click(screen.getByRole('button', { name: /remove/i }));
    await waitFor(() => expect(screen.getByText(/is used by form/i)).toBeInTheDocument());
  });
});
