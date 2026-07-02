// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { AssetTypes } from './AssetTypes';
import * as schemasApi from '../../api/schemas';

function wrap(node: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={qc}>{node}</QueryClientProvider>;
}
beforeEach(() => vi.restoreAllMocks());

describe('AssetTypes', () => {
  it('lists asset types and creates a new one with kind asset', async () => {
    vi.spyOn(schemasApi, 'listSchemas').mockResolvedValue([{ id: 's1', kind: 'asset', key: 'hardware', name: 'Hardware Asset', version: 1, status: 'published', definition: { fields: [] } }] as never);
    const create = vi.spyOn(schemasApi, 'createSchema').mockResolvedValue({ id: 's2', kind: 'asset', name: 'Servers', version: 1, status: 'published', key: 'servers', definition: { fields: [] } } as never);
    render(wrap(<AssetTypes go={vi.fn()} />));
    await waitFor(() => expect(screen.getByText('Hardware Asset')).toBeInTheDocument());
    await userEvent.type(screen.getByPlaceholderText(/new type name/i), 'Servers');
    await userEvent.click(screen.getByRole('button', { name: /add type/i }));
    await waitFor(() => expect(create).toHaveBeenCalledWith({ name: 'Servers', kind: 'asset' }));
  });

  it('edits the naming patterns and saves the merged definition', async () => {
    const schema = { id: 's1', kind: 'asset', key: 'hardware', name: 'Hardware Asset', version: 1, status: 'published',
      definition: { fields: [{ key: 'name', label: 'Name', type: 'text', required: false, order: 0, width: 'full' }] } };
    vi.spyOn(schemasApi, 'listSchemas').mockResolvedValue([schema] as never);
    vi.spyOn(schemasApi, 'getSchema').mockResolvedValue(schema as never);
    const update = vi.spyOn(schemasApi, 'updateSchema').mockResolvedValue(schema as never);
    render(wrap(<AssetTypes go={vi.fn()} />));
    await userEvent.click(await screen.findByText('Hardware Asset'));
    await userEvent.type(await screen.findByLabelText(/tag pattern/i), 'ACME-{{seq:0000}');
    await userEvent.click(screen.getByRole('button', { name: /save naming/i }));
    await waitFor(() => expect(update).toHaveBeenCalled());
    const [, patch] = update.mock.calls[0] as [string, { definition: unknown }];
    expect(patch.definition).toMatchObject({ tagTemplate: 'ACME-{seq:0000}', fields: expect.any(Array) });
  });
});
