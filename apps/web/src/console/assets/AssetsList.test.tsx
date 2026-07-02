// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { AssetsList } from './AssetsList';
import * as assetsApi from '../../api/assets';
import * as schemasApi from '../../api/schemas';

function wrap(node: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{node}</QueryClientProvider>;
}
beforeEach(() => vi.restoreAllMocks());

const asset = { id: 'a1', schemaId: 's1', schemaVersion: 1, assetTag: 'LAP-204', serial: null, status: 'in_use',
  ownerId: null, location: 'Bldg C', purchasedAt: null, warrantyExpiresAt: null, data: { name: 'Dell XPS' }, createdAt: '', updatedAt: '' };

describe('AssetsList', () => {
  it('renders assets and opens detail on row click', async () => {
    vi.spyOn(schemasApi, 'listSchemas').mockResolvedValue([{ id: 's1', kind: 'asset', key: 'hardware', name: 'Hardware Asset', version: 1, status: 'published', definition: { fields: [] } }] as never);
    vi.spyOn(assetsApi, 'queryAssets').mockResolvedValue({ rows: [asset], nextCursor: null } as never);
    const go = vi.fn();
    render(wrap(<AssetsList go={go} />));
    await waitFor(() => expect(screen.getByText('Dell XPS')).toBeInTheDocument());
    expect(screen.getByText('LAP-204')).toBeInTheDocument();
    const row = screen.getByText('Dell XPS').closest('tr')!;
    expect(within(row).getByText('In use')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Dell XPS'));
    expect(go).toHaveBeenCalledWith('assets', { assetId: 'a1' });
  });

  it('queries with a sort that matches the API contract (field, not key)', async () => {
    vi.spyOn(schemasApi, 'listSchemas').mockResolvedValue([] as never);
    const query = vi.spyOn(assetsApi, 'queryAssets').mockResolvedValue({ rows: [], nextCursor: null } as never);
    render(wrap(<AssetsList go={vi.fn()} />));
    await waitFor(() => expect(query).toHaveBeenCalled());
    // The shared `sortField` schema requires `field`; sending `key` makes POST /assets/query 400.
    expect(query.mock.calls[0][0]).toMatchObject({ sort: { field: 'updatedAt', dir: 'desc' } });
  });

  it('shows an empty state when there are no assets', async () => {
    vi.spyOn(schemasApi, 'listSchemas').mockResolvedValue([] as never);
    vi.spyOn(assetsApi, 'queryAssets').mockResolvedValue({ rows: [], nextCursor: null } as never);
    render(wrap(<AssetsList go={vi.fn()} />));
    await waitFor(() => expect(screen.getByText(/no assets/i)).toBeInTheDocument());
  });
});
