// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { RevisionHistory } from './RevisionHistory';
import * as kbApi from '../../api/kb';
import * as usersApi from '../../api/users';

function wrap(node: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{node}</QueryClientProvider>;
}
beforeEach(() => vi.restoreAllMocks());

describe('RevisionHistory', () => {
  it('lists versions, previews one, and restores a past version', async () => {
    vi.spyOn(usersApi, 'listUsers').mockResolvedValue([{ id: 'u1', name: 'Sam', email: '', role: 'agent', status: 'active', createdAt: '' }] as never);
    vi.spyOn(kbApi, 'listRevisions').mockResolvedValue([
      { id: 'r2', version: 2, title: 'A', authorId: 'u1', createdAt: '' },
      { id: 'r1', version: 1, title: 'A', authorId: 'u1', createdAt: '' },
    ] as never);
    vi.spyOn(kbApi, 'getRevision').mockResolvedValue({ id: 'r1', version: 1, title: 'Old', data: { body: [{ id: 'old', heading: 'Old', blocks: [{ t: 'p', html: 'text' }] }] }, createdAt: '' } as never);
    const restore = vi.spyOn(kbApi, 'restoreRevision').mockResolvedValue({ id: 'art1' } as never);
    render(wrap(<RevisionHistory articleId="art1" currentVersion={2} onClose={vi.fn()} onRestored={vi.fn()} />));
    await waitFor(() => expect(screen.getByText(/v2/i)).toBeInTheDocument());
    expect(screen.getByText(/current/i)).toBeInTheDocument();
    await userEvent.click(screen.getByText(/v1/i));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Old' })).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /restore/i }));
    await waitFor(() => expect(restore).toHaveBeenCalledWith('art1', 'r1'));
  });
});
