// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { PortalKnowledge } from './PortalKnowledge';
import * as portalApi from '../../api/portal';

function wrap(node: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{node}</QueryClientProvider>;
}
beforeEach(() => vi.restoreAllMocks());

const summary = {
  id: 'a1', title: 'Fix a printer that shows offline', slug: 'fix-printer',
  category: 'Hardware', categoryGroup: 'IT', excerpt: 'Fastest checks.', readMin: 2,
  tags: [], updatedAt: '2026-06-03T00:00:00Z',
};

describe('PortalKnowledge', () => {
  it('renders articles grouped by category with search', async () => {
    vi.spyOn(portalApi, 'listPublicArticles').mockResolvedValue([summary]);
    const onOpen = vi.fn();
    render(wrap(<PortalKnowledge onOpen={onOpen} onBack={vi.fn()} />));
    await waitFor(() => expect(screen.getByText('Fix a printer that shows offline')).toBeInTheDocument());
    expect(screen.getByText('IT & Software')).toBeInTheDocument();
    expect(screen.getByText('Fastest checks.')).toBeInTheDocument();
  });

  it('navigates to article on card click', async () => {
    vi.spyOn(portalApi, 'listPublicArticles').mockResolvedValue([summary]);
    const onOpen = vi.fn();
    render(wrap(<PortalKnowledge onOpen={onOpen} onBack={vi.fn()} />));
    await waitFor(() => expect(screen.getByText('Fix a printer that shows offline')).toBeInTheDocument());
    await userEvent.click(screen.getByText('Fix a printer that shows offline'));
    expect(onOpen).toHaveBeenCalledWith('a1');
  });
});
