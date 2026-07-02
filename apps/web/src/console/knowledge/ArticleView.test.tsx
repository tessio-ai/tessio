// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ArticleView } from './ArticleView';
import * as kbApi from '../../api/kb';

function wrap(node: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{node}</QueryClientProvider>;
}
beforeEach(() => vi.restoreAllMocks());

const article = {
  id: 'a1', title: 'Fix a printer that shows offline', slug: 'fix-printer',
  status: 'published' as const, publishedAt: '', authorId: null,
  schemaId: 's1', schemaVersion: 1, contentVersion: 1,
  data: {
    body: [
      { id: 'check', heading: 'Start with the basics', blocks: [{ t: 'p', html: 'Check the panel.' }] },
      { id: 'queue', heading: 'Clear a stuck print job', blocks: [{ t: 'steps', items: ['Open Settings.', 'Cancel errored jobs.'] }] },
    ],
    excerpt: 'Fastest checks to bring a printer back online.',
    tldr: ['Most offline printers are stuck jobs.', 'Clear the queue and re-select.'],
    categoryGroup: 'IT', category: 'Hardware',
    relatedArticles: [], linkedForm: 'report_incident', readMin: 2, tags: [],
  },
  createdAt: '2026-06-01T00:00:00Z', updatedAt: '2026-06-03T00:00:00Z',
};

describe('ArticleView', () => {
  it('renders title, category label, TL;DR, and prose sections', async () => {
    vi.spyOn(kbApi, 'getArticle').mockResolvedValue(article as never);
    render(wrap(<ArticleView articleId="a1" go={vi.fn()} />));
    await waitFor(() => expect(screen.getByText('Fix a printer that shows offline')).toBeInTheDocument());
    expect(screen.getByText(/IT & SOFTWARE/i)).toBeInTheDocument();
    expect(screen.getByText('Tess summary')).toBeInTheDocument();
    expect(screen.getByText(/stuck jobs/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Start with the basics' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Clear a stuck print job' })).toBeInTheDocument();
  });

  it('renders TOC sidebar with section links', async () => {
    vi.spyOn(kbApi, 'getArticle').mockResolvedValue(article as never);
    render(wrap(<ArticleView articleId="a1" go={vi.fn()} />));
    await waitFor(() => expect(screen.getAllByText('Start with the basics').length).toBeGreaterThan(0));
    const toc = document.querySelector('.toc');
    expect(toc).toBeTruthy();
    expect(toc?.querySelectorAll('.toc-item')).toHaveLength(2);
  });

  it('renders feedback and open-ticket CTA', async () => {
    vi.spyOn(kbApi, 'getArticle').mockResolvedValue(article as never);
    render(wrap(<ArticleView articleId="a1" go={vi.fn()} />));
    await waitFor(() => expect(screen.getByText('Was this article helpful?')).toBeInTheDocument());
    expect(screen.getByText(/Didn.t solve it/)).toBeInTheDocument();
  });

  it('back link navigates to knowledge list', async () => {
    vi.spyOn(kbApi, 'getArticle').mockResolvedValue(article as never);
    const go = vi.fn();
    render(wrap(<ArticleView articleId="a1" go={go} />));
    await waitFor(() => expect(screen.getByText('Knowledge Base')).toBeInTheDocument());
    await userEvent.click(screen.getByText('Knowledge Base'));
    expect(go).toHaveBeenCalledWith('knowledge');
  });
});
