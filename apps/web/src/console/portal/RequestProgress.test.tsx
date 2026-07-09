// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { RequestProgress } from './RequestProgress';
import * as portalApi from '../../api/portal';
import * as ticketsApi from '../../api/tickets';
import * as activityApi from '../../api/activity';
import * as commentsApi from '../../api/comments';
import * as authCtx from '../../auth/AuthContext';
import type { TicketRow } from '../../api/types';

function wrap(node: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{node}</QueryClientProvider>;
}

const ticket = (over: Partial<TicketRow> = {}): TicketRow => ({
  id: 't1', number: 7, status: 'in_progress', priority: null, requesterId: 'u1', assigneeId: null, teamId: null,
  dueAt: null, schemaId: 's1', schemaVersion: 1, data: { title: 'Broken printer' },
  createdAt: '2026-07-01T10:00:00Z', updatedAt: '2026-07-02T10:00:00Z', formId: 'f1',
  slaResponseDueAt: null, slaResolutionDueAt: null, firstRespondedAt: null, slaResponseBreachedAt: null, slaResolutionBreachedAt: null,
  ...over,
});

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(authCtx, 'useAuth').mockReturnValue({ user: { id: 'u1', email: 'd@a.io', name: 'Dana Lee', role: 'requester' }, loading: false, login: vi.fn(), logout: vi.fn() } as never);
  vi.spyOn(portalApi, 'getPublicPortalSettings').mockResolvedValue({ accent: '#4f46e5' } as never);
  vi.spyOn(ticketsApi, 'getTicket').mockResolvedValue(ticket());
  vi.spyOn(activityApi, 'listTicketActivity').mockResolvedValue([
    { id: 'a1', actorId: 'u1', eventType: 'created', changes: null, createdAt: '2026-07-01T10:00:00Z' },
    { id: 'a2', actorId: 'ag1', eventType: 'status', changes: { from: 'open', to: 'in_progress' }, createdAt: '2026-07-02T09:00:00Z' },
    { id: 'a3', actorId: 'ag1', eventType: 'assigned', changes: { from: null, to: 'ag1' }, createdAt: '2026-07-02T09:00:00Z' },
  ]);
  vi.spyOn(commentsApi, 'listTicketComments').mockResolvedValue([
    { id: 'c1', recordType: 'ticket', recordId: 't1', authorId: 'ag1', body: 'We are on it.', internal: false, createdAt: '2026-07-02T10:00:00Z' },
  ]);
});
afterEach(() => vi.restoreAllMocks());

describe('RequestProgress', () => {
  it('shows the ticket header, current status, and progress steps', async () => {
    render(wrap(<RequestProgress ticketId="t1" onBack={vi.fn()} onNewRequest={vi.fn()} />));
    await waitFor(() => expect(screen.getByText('Broken printer')).toBeInTheDocument());
    expect(screen.getByText(/#7 · submitted/)).toBeInTheDocument();
    const steps = screen.getByRole('list', { name: /request progress/i });
    expect(steps).toBeInTheDocument();
    // in_progress → second step is current and carries the live status label.
    const current = document.querySelector('.rp-step.current');
    expect(current?.textContent).toMatch(/in progress/i);
    expect(document.querySelectorAll('.rp-step.done')).toHaveLength(1);
  });

  it('renders the timeline with submission, status change, and the agent reply — but no internal ops', async () => {
    render(wrap(<RequestProgress ticketId="t1" onBack={vi.fn()} onNewRequest={vi.fn()} />));
    await waitFor(() => expect(screen.getByText('Request submitted')).toBeInTheDocument());
    expect(screen.getByText('Status changed to In progress')).toBeInTheDocument();
    expect(screen.getByText('We are on it.')).toBeInTheDocument();
    expect(screen.getByText('Support team')).toBeInTheDocument();
    expect(screen.queryByText(/assigned/i)).not.toBeInTheDocument();
  });

  it('sends a reply and clears the composer', async () => {
    const add = vi.spyOn(commentsApi, 'addTicketComment').mockResolvedValue({ id: 'c2', recordType: 'ticket', recordId: 't1', authorId: 'u1', body: 'Thanks!', internal: false, createdAt: '2026-07-03T10:00:00Z' });
    render(wrap(<RequestProgress ticketId="t1" onBack={vi.fn()} onNewRequest={vi.fn()} />));
    const input = await screen.findByLabelText(/reply to the support team/i);
    await userEvent.type(input, 'Thanks!');
    await userEvent.click(screen.getByRole('button', { name: /send reply/i }));
    await waitFor(() => expect(add).toHaveBeenCalledWith('t1', { body: 'Thanks!' }));
    await waitFor(() => expect(input).toHaveValue(''));
  });

  it('hides the composer on closed tickets and offers a new request instead', async () => {
    vi.spyOn(ticketsApi, 'getTicket').mockResolvedValue(ticket({ status: 'closed' }));
    const onNewRequest = vi.fn();
    render(wrap(<RequestProgress ticketId="t1" onBack={vi.fn()} onNewRequest={onNewRequest} />));
    await waitFor(() => expect(screen.getByText(/this request is closed/i)).toBeInTheDocument());
    expect(screen.queryByLabelText(/reply to the support team/i)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /submit a new request/i }));
    expect(onNewRequest).toHaveBeenCalled();
  });

  it('goes back to the request list', async () => {
    const onBack = vi.fn();
    render(wrap(<RequestProgress ticketId="t1" onBack={onBack} onNewRequest={vi.fn()} />));
    await userEvent.click(await screen.findByRole('button', { name: /my requests/i }));
    expect(onBack).toHaveBeenCalled();
  });

  it('shows an error state when the ticket cannot be loaded', async () => {
    vi.spyOn(ticketsApi, 'getTicket').mockRejectedValue(new Error('403'));
    render(wrap(<RequestProgress ticketId="t1" onBack={vi.fn()} onNewRequest={vi.fn()} />));
    await waitFor(() => expect(screen.getByText(/couldn't load this request/i)).toBeInTheDocument());
  });
});
