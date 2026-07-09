// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { NewTicketForm } from './NewTicketForm';
import * as schemasApi from '../api/schemas';
import * as ticketsApi from '../api/tickets';

function wrap(node: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{node}</QueryClientProvider>;
}

beforeEach(() => {
  vi.spyOn(schemasApi, 'listSchemas').mockResolvedValue([
    {
      id: 'sch1',
      kind: 'ticket',
      key: 'incident',
      name: 'Incident',
      version: 2,
      status: 'published',
      definition: { fields: [{ key: 'title', label: 'Title', type: 'text', order: 0, required: true, width: 'full' }] },
    },
  ]);
  vi.spyOn(ticketsApi, 'createTicket').mockResolvedValue({ id: 't9', number: 5, status: null, priority: null, requesterId: null, assigneeId: null, teamId: null, dueAt: null, schemaId: 'sch1', schemaVersion: 2, data: {}, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', formId: null, parentId: null, slaResponseDueAt: null, slaResolutionDueAt: null, firstRespondedAt: null, slaResponseBreachedAt: null, slaResolutionBreachedAt: null });
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('NewTicketForm', () => {
  it('renders a form from the fetched ticket schema and creates a ticket on submit', async () => {
    const onCreated = vi.fn();
    render(wrap(<NewTicketForm onCreated={onCreated} />));

    const titleInput = await screen.findByLabelText('Title');
    await userEvent.type(titleInput, 'Server down');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(ticketsApi.createTicket).toHaveBeenCalled());
    expect(ticketsApi.createTicket).toHaveBeenCalledWith({
      schemaId: 'sch1',
      schemaVersion: 2,
      data: { title: 'Server down' },
    });
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
  });

  it('shows a message when there are no published ticket types', async () => {
    vi.mocked(schemasApi.listSchemas).mockResolvedValue([]);
    render(wrap(<NewTicketForm onCreated={() => {}} />));
    expect(await screen.findByText(/No ticket types defined/i)).toBeInTheDocument();
  });
});
