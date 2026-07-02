// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ArticleEditor } from './ArticleEditor';
import * as kbApi from '../../api/kb';

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', name: 'Test User' } }),
}));

function wrap(node: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{node}</QueryClientProvider>;
}
beforeEach(() => vi.restoreAllMocks());

describe('ArticleEditor', () => {
  it('renders new article mode with empty fields', () => {
    vi.spyOn(kbApi, 'queryArticles').mockResolvedValue({ rows: [], nextCursor: null } as never);
    render(wrap(<ArticleEditor go={vi.fn()} />));
    expect(screen.getByPlaceholderText('Article title')).toHaveValue('');
    expect(screen.getByText('New article')).toBeInTheDocument();
    expect(screen.getByText('Save draft')).toBeInTheDocument();
  });

  it('renders formatting toolbar with Bold, Italic', () => {
    vi.spyOn(kbApi, 'queryArticles').mockResolvedValue({ rows: [], nextCursor: null } as never);
    render(wrap(<ArticleEditor go={vi.fn()} />));
    expect(screen.getByTitle('Bold')).toBeInTheDocument();
    expect(screen.getByTitle('Italic')).toBeInTheDocument();
  });

  it('renders settings sidebar with status, category, and Draft with Tess', () => {
    vi.spyOn(kbApi, 'queryArticles').mockResolvedValue({ rows: [], nextCursor: null } as never);
    render(wrap(<ArticleEditor go={vi.fn()} />));
    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(screen.getByText('Published')).toBeInTheDocument();
    expect(screen.getByText('Draft with Tess')).toBeInTheDocument();
  });

  it('loads existing article into fields when editing', async () => {
    const article = {
      id: 'a1', title: 'Fix printer', slug: 'fix-printer', status: 'published' as const,
      publishedAt: '', authorId: null, schemaId: 's1', schemaVersion: 1, contentVersion: 1,
      data: {
        body: [{ id: 'check', heading: 'Check', blocks: [{ t: 'p', html: 'Check it.' }] }],
        excerpt: 'Quick fix guide', tldr: [], categoryGroup: 'IT', category: 'Hardware',
        relatedArticles: [], linkedForm: '', readMin: 2, tags: [],
      },
      createdAt: '', updatedAt: '',
    };
    vi.spyOn(kbApi, 'getArticle').mockResolvedValue(article as never);
    vi.spyOn(kbApi, 'queryArticles').mockResolvedValue({ rows: [], nextCursor: null } as never);
    render(wrap(<ArticleEditor articleId="a1" go={vi.fn()} />));
    await waitFor(() => expect(screen.getByPlaceholderText('Article title')).toHaveValue('Fix printer'));
    expect(screen.getByText('Editing')).toBeInTheDocument();
  });
});
