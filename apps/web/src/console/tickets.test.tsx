// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { TicketsList } from './tickets';
import * as ticketsApi from '../api/tickets';
import * as usersApi from '../api/users';
import * as schemasApi from '../api/schemas';

function wrap(node: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{node}</QueryClientProvider>;
}
beforeEach(() => vi.restoreAllMocks());
const noop = () => {};
const row = { id: 't1', number: 142, status: 'open', priority: 'high', requesterId: 'r1', assigneeId: null, teamId: null,
  dueAt: null, schemaId: 's1', schemaVersion: 1, data: { title: 'Printer offline' }, createdAt: '2026-06-01T00:00:00Z', updatedAt: '2026-06-02T00:00:00Z', formId: null };
function mountProps(go = vi.fn()) {
  return { go, route: { screen: 'tickets' } as never, density: 'comfortable', setDensity: noop, selected: new Set<string>(), setSelected: noop, loading: false, me: null };
}
describe('TicketsList (restored)', () => {
  it('renders real tickets in the designed table and opens detail on row click', async () => {
    vi.spyOn(usersApi, 'listUsers').mockResolvedValue([] as never);
    vi.spyOn(schemasApi, 'listSchemas').mockResolvedValue([] as never);
    vi.spyOn(ticketsApi, 'queryTickets').mockResolvedValue({ rows: [row], nextCursor: null } as never);
    const go = vi.fn();
    render(wrap(<TicketsList {...mountProps(go)} />));
    await waitFor(() => expect(screen.getByText('Printer offline')).toBeInTheDocument());
    await userEvent.click(screen.getByText('Printer offline'));
    expect(go).toHaveBeenCalledWith('tickets', { ticketId: 't1' });
  });
  it('fetches with the field-based sort contract', async () => {
    vi.spyOn(usersApi, 'listUsers').mockResolvedValue([] as never);
    vi.spyOn(schemasApi, 'listSchemas').mockResolvedValue([] as never);
    const q = vi.spyOn(ticketsApi, 'queryTickets').mockResolvedValue({ rows: [], nextCursor: null } as never);
    render(wrap(<TicketsList {...mountProps()} />));
    await waitFor(() => expect(q).toHaveBeenCalled());
    expect(q.mock.calls[0][0]).toMatchObject({ sort: { field: 'updatedAt', dir: 'desc' } });
  });
});
