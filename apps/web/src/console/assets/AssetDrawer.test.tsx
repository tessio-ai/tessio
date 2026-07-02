// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { AssetDrawer } from './AssetDrawer';
import * as assetsApi from '../../api/assets';
import * as schemasApi from '../../api/schemas';
import type { AssetRow } from '../../api/types';

function wrap(node: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={qc}>{node}</QueryClientProvider>;
}
beforeEach(() => vi.restoreAllMocks());
const schema = { id: 's1', kind: 'asset', key: 'hardware', name: 'Hardware Asset', version: 1, status: 'published',
  definition: { fields: [{ key: 'name', label: 'Name', type: 'text', required: true, order: 0, width: 'full' }] } };

describe('AssetDrawer', () => {
  it('creates an asset with the chosen schema, typed fields, and data', async () => {
    vi.spyOn(schemasApi, 'listSchemas').mockResolvedValue([schema] as never);
    const create = vi.spyOn(assetsApi, 'createAsset').mockResolvedValue({ id: 'a9' } as never);
    const onClose = vi.fn();
    render(wrap(<AssetDrawer onClose={onClose} />));
    await waitFor(() => expect(screen.getByText(/new asset/i)).toBeInTheDocument());
    await userEvent.type(screen.getByLabelText(/asset tag/i), 'LAP-9');
    await userEvent.type(screen.getByLabelText(/^name/i), 'New Laptop');
    await userEvent.click(screen.getByRole('button', { name: /create asset/i }));
    await waitFor(() => expect(create).toHaveBeenCalled());
    const arg = create.mock.calls[0][0];
    expect(arg.schemaId).toBe('s1');
    expect(arg.assetTag).toBe('LAP-9');
    expect(arg.data).toMatchObject({ name: 'New Laptop' });
  });

  it('edits an existing asset (prefilled, type locked, PATCH)', async () => {
    const schema = { id: 's1', kind: 'asset', key: 'hardware', name: 'Hardware Asset', version: 1, status: 'published',
      definition: { fields: [{ key: 'model', label: 'Model', type: 'text', required: false, order: 0, width: 'full' }] } };
    vi.spyOn(schemasApi, 'listSchemas').mockResolvedValue([schema] as never);
    const update = vi.spyOn(assetsApi, 'updateAsset').mockResolvedValue({ id: 'a1' } as never);
    const asset = { id: 'a1', schemaId: 's1', schemaVersion: 1, assetTag: 'LAP-1', serial: null, status: 'in_use',
      ownerId: null, location: 'C', purchasedAt: null, warrantyExpiresAt: null, data: { name: 'Old', model: 'XPS' }, createdAt: '', updatedAt: '' } as AssetRow;
    render(wrap(<AssetDrawer asset={asset} onClose={vi.fn()} />));
    await waitFor(() => expect(screen.getByText(/edit asset/i)).toBeInTheDocument());
    expect((screen.getByLabelText(/asset tag/i) as HTMLInputElement).value).toBe('LAP-1');
    expect(screen.getByLabelText(/^type/i)).toBeDisabled();
    await userEvent.clear(screen.getByLabelText(/^name/i));
    await userEvent.type(screen.getByLabelText(/^name/i), 'New name');
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(update.mock.calls[0][1]).toMatchObject({ data: expect.objectContaining({ name: 'New name' }) });
  });
});
