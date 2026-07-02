// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { PortalArticle } from './PortalArticle';
import * as portalApi from '../../api/portal';

function wrap(node: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{node}</QueryClientProvider>;
}
beforeEach(() => vi.restoreAllMocks());

const article = {
  id: 'a1', title: 'Fix a printer that shows offline', slug: 'fix-printer',
  category: 'Hardware', categoryGroup: 'IT', tags: [],
  body: [{ id: 'check', heading: 'Start with the basics', blocks: [{ t: 'p' as const, html: 'Check the panel.' }] }],
  tldr: ['Most offline printers are stuck jobs.'],
  relatedArticles: [], linkedForm: 'report_incident', readMin: 2,
  updatedAt: '2026-06-03T00:00:00Z', authorId: null,
};

describe('PortalArticle', () => {
  it('renders title, TL;DR, prose, and submit-a-request CTA', async () => {
    vi.spyOn(portalApi, 'getPublicArticle').mockResolvedValue(article as never);
    render(wrap(<PortalArticle id="a1" onBack={vi.fn()} onOpenForm={vi.fn()} />));
    await waitFor(() => expect(screen.getByText('Fix a printer that shows offline')).toBeInTheDocument());
    expect(screen.getByText('Tess summary')).toBeInTheDocument();
    expect(screen.getByText(/stuck jobs/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Start with the basics' })).toBeInTheDocument();
    expect(screen.getByText(/Still need help/)).toBeInTheDocument();
  });
});
