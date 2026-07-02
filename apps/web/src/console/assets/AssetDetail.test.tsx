// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { AssetDetail } from './AssetDetail';
import * as assetsApi from '../../api/assets';
import * as commentsApi from '../../api/comments';
import * as schemasApi from '../../api/schemas';

function wrap(node: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={qc}>{node}</QueryClientProvider>;
}
beforeEach(() => vi.restoreAllMocks());
const asset = { id: 'a1', schemaId: 's1', schemaVersion: 1, assetTag: 'LAP-204', serial: 'SN1', status: 'in_use', ownerId: null, location: 'Bldg C', purchasedAt: null, warrantyExpiresAt: null, data: { name: 'Dell XPS' }, createdAt: '', updatedAt: '' };

describe('AssetDetail', () => {
  it('shows the asset and posts a comment on the Activity tab', async () => {
    vi.spyOn(assetsApi, 'getAsset').mockResolvedValue(asset as never);
    vi.spyOn(schemasApi, 'listSchemas').mockResolvedValue([{ id: 's1', kind: 'asset', key: 'hardware', name: 'Hardware Asset', version: 1, status: 'published', definition: { fields: [{ key: 'name', label: 'Name', type: 'text', required: true, order: 0, width: 'full' }] } }] as never);
    vi.spyOn(commentsApi, 'listAssetComments').mockResolvedValue([] as never);
    const add = vi.spyOn(commentsApi, 'addAssetComment').mockResolvedValue({ id: 'c1' } as never);
    render(wrap(<AssetDetail assetId="a1" go={vi.fn()} />));
    await waitFor(() => expect(screen.getByText('Dell XPS')).toBeInTheDocument());
    expect(screen.getByText('LAP-204')).toBeInTheDocument();
    await userEvent.type(screen.getByPlaceholderText(/add a comment/i), 'Checked it');
    await userEvent.click(screen.getByRole('button', { name: /comment/i }));
    await waitFor(() => expect(add).toHaveBeenCalledWith('a1', { body: 'Checked it', internal: false }));
  });

  it('navigates back, and deletes after confirm', async () => {
    vi.spyOn(assetsApi, 'getAsset').mockResolvedValue(asset as never);
    vi.spyOn(schemasApi, 'listSchemas').mockResolvedValue([] as never);
    vi.spyOn(commentsApi, 'listAssetComments').mockResolvedValue([] as never);
    const del = vi.spyOn(assetsApi, 'deleteAsset').mockResolvedValue(undefined as never);
    const go = vi.fn();
    render(wrap(<AssetDetail assetId="a1" go={go} />));
    await waitFor(() => expect(screen.getByText('Dell XPS')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /back to assets/i }));
    expect(go).toHaveBeenCalledWith('assets');
    await userEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    await userEvent.click(screen.getByRole('button', { name: /delete asset/i })); // confirm
    await waitFor(() => expect(del).toHaveBeenCalledWith('a1'));
  });
});
