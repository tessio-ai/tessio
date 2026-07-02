// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { TicketsPage } from './TicketsPage';
import * as ticketsApi from '../api/tickets';

function wrap(node: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{node}</QueryClientProvider>;
}

beforeEach(() => {
  vi.spyOn(ticketsApi, 'queryTickets');
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('TicketsPage', () => {
  it('renders rows returned by the API', async () => {
    vi.mocked(ticketsApi.queryTickets).mockResolvedValue({
      rows: [{ id: 't1', number: 1, status: 'open', priority: 'high', requesterId: null, assigneeId: null, teamId: null, dueAt: null, schemaId: 's1', schemaVersion: 1, data: { title: 'Printer down' }, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', formId: null, slaResponseDueAt: null, slaResolutionDueAt: null, firstRespondedAt: null, slaResponseBreachedAt: null, slaResolutionBreachedAt: null }],
      nextCursor: null,
    });
    render(wrap(<TicketsPage />));
    expect(await screen.findByText('Printer down')).toBeInTheDocument();
    expect(screen.getByText('open')).toBeInTheDocument();
  });

  it('shows an empty state when there are no tickets', async () => {
    vi.mocked(ticketsApi.queryTickets).mockResolvedValue({ rows: [], nextCursor: null });
    render(wrap(<TicketsPage />));
    expect(await screen.findByText('No tickets yet')).toBeInTheDocument();
  });

  it('shows an error state when the request fails', async () => {
    vi.mocked(ticketsApi.queryTickets).mockRejectedValue(new Error('boom'));
    render(wrap(<TicketsPage />));
    expect(await screen.findByText(/Failed to load tickets/i)).toBeInTheDocument();
  });
});
