// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { KnowledgeList } from './KnowledgeList';
import * as kbApi from '../../api/kb';

function wrap(node: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{node}</QueryClientProvider>;
}
beforeEach(() => vi.restoreAllMocks());

const row = {
  id: 'a1', title: 'Fix a printer that shows offline', slug: 'fix-printer', status: 'published' as const,
  publishedAt: '', authorId: null, schemaId: 's1', schemaVersion: 1, contentVersion: 1,
  data: {
    body: [{ id: 'check', heading: 'Check', blocks: [{ t: 'p', html: 'Check the panel.' }] }],
    excerpt: 'The fastest checks to bring a shared printer back online.',
    tldr: ['Most offline printers are stuck jobs.'],
    categoryGroup: 'IT', category: 'Hardware',
    relatedArticles: [], linkedForm: '', readMin: 2, tags: [],
  },
  createdAt: '2026-06-01T00:00:00Z', updatedAt: '2026-06-03T00:00:00Z',
};

describe('KnowledgeList', () => {
  it('renders articles with category and excerpt', async () => {
    vi.spyOn(kbApi, 'queryArticles').mockResolvedValue({ rows: [row], nextCursor: null } as never);
    render(wrap(<KnowledgeList go={vi.fn()} />));
    await waitFor(() => expect(screen.getByText('Fix a printer that shows offline')).toBeInTheDocument());
    expect(screen.getByText('Hardware')).toBeInTheDocument();
    expect(screen.getByText(/fastest checks/)).toBeInTheDocument();
  });

  it('navigates to article on row click', async () => {
    vi.spyOn(kbApi, 'queryArticles').mockResolvedValue({ rows: [row], nextCursor: null } as never);
    const go = vi.fn();
    render(wrap(<KnowledgeList go={go} />));
    await waitFor(() => expect(screen.getByText('Fix a printer that shows offline')).toBeInTheDocument());
    await userEvent.click(screen.getByText('Fix a printer that shows offline'));
    expect(go).toHaveBeenCalledWith('knowledge', { articleId: 'a1' });
  });

  it('filters by search text', async () => {
    vi.spyOn(kbApi, 'queryArticles').mockResolvedValue({ rows: [row], nextCursor: null } as never);
    render(wrap(<KnowledgeList go={vi.fn()} />));
    await waitFor(() => expect(screen.getByText('Fix a printer that shows offline')).toBeInTheDocument());
    await userEvent.type(screen.getByPlaceholderText('Search articles…'), 'vpn');
    expect(screen.queryByText('Fix a printer that shows offline')).not.toBeInTheDocument();
  });

  it('shows empty state when no articles match', async () => {
    vi.spyOn(kbApi, 'queryArticles').mockResolvedValue({ rows: [], nextCursor: null } as never);
    render(wrap(<KnowledgeList go={vi.fn()} />));
    await waitFor(() => expect(screen.getByText(/No articles/)).toBeInTheDocument());
  });
});
