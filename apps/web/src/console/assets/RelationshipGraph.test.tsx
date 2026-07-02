// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { RelationshipGraph } from './RelationshipGraph';
import * as linksApi from '../../api/links';
import * as assetsApi from '../../api/assets';

function wrap(node: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{node}</QueryClientProvider>;
}
beforeEach(() => vi.restoreAllMocks());

describe('RelationshipGraph', () => {
  it('renders linked records grouped by relationship, with an accessible list equivalent', async () => {
    vi.spyOn(linksApi, 'listAssetLinks').mockResolvedValue([
      { id: 'l1', fromType: 'asset', fromId: 'a1', toType: 'asset', toId: 'a2', relationshipType: 'depends_on', createdAt: '' },
    ] as never);
    render(wrap(<RelationshipGraph assetId="a1" assetName="Server 1" go={vi.fn()} />));
    await waitFor(() => expect(screen.getByText(/depends_on/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /a2/i })).toBeInTheDocument();
  });

  it('shows an empty state with an add-link action when there are no links', async () => {
    vi.spyOn(linksApi, 'listAssetLinks').mockResolvedValue([] as never);
    render(wrap(<RelationshipGraph assetId="a1" assetName="Server 1" go={vi.fn()} />));
    await waitFor(() => expect(screen.getByText(/no links yet/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /add link/i })).toBeInTheDocument();
  });

  it('adds a link by picking an asset from the type-ahead', async () => {
    vi.spyOn(linksApi, 'listAssetLinks').mockResolvedValue([] as never);
    vi.spyOn(assetsApi, 'queryAssets').mockResolvedValue({ rows: [{ id: 'a2', assetTag: 'SRV-9', schemaId: 's', schemaVersion: 1, serial: null, status: null, ownerId: null, location: null, purchasedAt: null, warrantyExpiresAt: null, data: {}, createdAt: '', updatedAt: '' }], nextCursor: null } as never);
    const add = vi.spyOn(linksApi, 'addAssetLink').mockResolvedValue({ id: 'l1' } as never);
    render(wrap(<RelationshipGraph assetId="a1" assetName="S1" go={vi.fn()} />));
    await userEvent.click(await screen.findByRole('button', { name: /add link/i }));
    await userEvent.type(screen.getByRole('combobox', { name: /find asset/i }), 'SRV');
    const option = await screen.findByRole('option', { name: /SRV-9/i });
    await userEvent.click(option);
    await waitFor(() => expect(add).toHaveBeenCalledWith('a1', expect.objectContaining({ toType: 'asset', toId: 'a2' })));
  });
});
