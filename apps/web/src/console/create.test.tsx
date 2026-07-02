// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { CreateDrawer } from './create';
import * as ticketsApi from '../api/tickets';
import * as schemasApi from '../api/schemas';

function wrap(node: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{node}</QueryClientProvider>;
}
beforeEach(() => vi.restoreAllMocks());

const incident = { id: 's1', kind: 'ticket', key: 'incident', name: 'Incident', version: 1, status: 'published',
  definition: { fields: [{ key: 'title', label: 'Title', type: 'text', required: true, order: 0, width: 'full' }] } };

describe('CreateDrawer (SP2)', () => {
  it('posts with the chosen Priority as a top-level field (not in data)', async () => {
    vi.spyOn(schemasApi, 'listSchemas').mockResolvedValue([incident] as never);
    const create = vi.spyOn(ticketsApi, 'createTicket').mockResolvedValue({ id: 't9' } as never);
    const go = vi.fn();
    render(wrap(<CreateDrawer onClose={vi.fn()} go={go} />));
    await waitFor(() => expect(screen.getByLabelText(/Title/)).toBeInTheDocument());
    await userEvent.type(screen.getByLabelText(/Title/), 'Printer down');
    await userEvent.selectOptions(screen.getByLabelText('Priority'), 'high');
    await userEvent.click(screen.getByRole('button', { name: 'Create ticket' }));
    await waitFor(() => expect(create).toHaveBeenCalled());
    const arg = (create.mock.calls[0][0]) as { priority?: string; data?: Record<string, unknown> };
    expect(arg.priority).toBe('high');
    expect(arg.data?.title).toBe('Printer down');
    expect(arg.data?.priority).toBeUndefined();
    expect(go).toHaveBeenCalledWith('tickets', { ticketId: 't9' });
  });
});
