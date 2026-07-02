// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { TicketDetail } from './detail';
import * as ticketsApi from '../api/tickets';
import * as usersApi from '../api/users';
import * as commentsApi from '../api/comments';
import * as schemasApi from '../api/schemas';
import * as linksApi from '../api/links';
import * as teamsApi from '../api/teams';
import * as activityApi from '../api/activity';
import * as attachmentsApi from '../api/attachments';

function wrap(node: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{node}</QueryClientProvider>;
}
beforeEach(() => vi.restoreAllMocks());

const ticket = { id: 't1', number: 142, status: 'open', priority: 'high', requesterId: 'r1', assigneeId: null, teamId: null,
  dueAt: null, schemaId: 's1', schemaVersion: 1, data: { title: 'Printer offline', description: 'down' }, createdAt: '2026-06-01T00:00:00Z', updatedAt: '2026-06-02T00:00:00Z', formId: null };

function mocks() {
  vi.spyOn(ticketsApi, 'getTicket').mockResolvedValue(ticket as never);
  vi.spyOn(usersApi, 'listUsers').mockResolvedValue([{ id: 'u1', name: 'Sam Rivera', email: '', role: 'agent', status: 'active', createdAt: '' }] as never);
  vi.spyOn(commentsApi, 'listTicketComments').mockResolvedValue([] as never);
  vi.spyOn(schemasApi, 'listSchemas').mockResolvedValue([{ id: 's1', kind: 'ticket', key: 'it', name: 'IT Ticket', version: 1, status: 'published', definition: { fields: [] } }] as never);
  vi.spyOn(linksApi, 'listTicketLinks').mockResolvedValue([] as never);
  vi.spyOn(teamsApi, 'listTeams').mockResolvedValue([{ id: 'team1', name: 'IT Ops', createdAt: '' }] as never);
  vi.spyOn(attachmentsApi, 'listTicketAttachments').mockResolvedValue([{ id: 'att1', filename: 'screenshot.png', size: 2048, mime: 'image/png', uploadedBy: 'u1', createdAt: '' }] as never);
  vi.spyOn(activityApi, 'listTicketActivity').mockResolvedValue([
    { id: 'e1', actorId: 'u1', eventType: 'created', changes: null, createdAt: '2026-06-01T00:00:00Z' },
    { id: 'e2', actorId: 'u1', eventType: 'status', changes: { from: 'open', to: 'resolved' }, createdAt: '2026-06-01T01:00:00Z' },
    { id: 'e3', actorId: 'u1', eventType: 'team', changes: { from: null, to: 'team1' }, createdAt: '2026-06-01T02:00:00Z' },
  ] as never);
}

describe('TicketDetail (restored)', () => {
  it('renders the designed detail for a real ticket', async () => {
    mocks();
    render(wrap(<TicketDetail ticketId="t1" go={vi.fn()} addToast={vi.fn()} />));
    await waitFor(() => expect(screen.getByText('Printer offline')).toBeInTheDocument());
    expect(screen.getByText('#142')).toBeInTheDocument();
  });

  it('changing status PATCHes the ticket', async () => {
    mocks();
    const patch = vi.spyOn(ticketsApi, 'updateTicket').mockResolvedValue(ticket as never);
    render(wrap(<TicketDetail ticketId="t1" go={vi.fn()} addToast={vi.fn()} />));
    await waitFor(() => expect(screen.getByText('Printer offline')).toBeInTheDocument());
    // Status is a custom Popover select: open it (trigger shows the current label), then pick an option.
    const statusRow = screen.getByText('Status').closest('.prop-row') as HTMLElement;
    await userEvent.click(within(statusRow).getByText('Open'));
    await userEvent.click(within(statusRow).getByText('Closed'));
    expect(patch).toHaveBeenCalledWith('t1', { status: 'closed' });
  });

  it('posts a comment via the composer', async () => {
    mocks();
    const add = vi.spyOn(commentsApi, 'addTicketComment').mockResolvedValue({ id: 'c1' } as never);
    render(wrap(<TicketDetail ticketId="t1" go={vi.fn()} addToast={vi.fn()} />));
    await waitFor(() => expect(screen.getByText('Printer offline')).toBeInTheDocument());
    await userEvent.type(screen.getByRole('textbox'), 'Looking into it');
    await userEvent.click(screen.getByRole('button', { name: /send/i }));
    expect(add).toHaveBeenCalledWith('t1', { body: 'Looking into it', internal: false });
  });

  it('changing the Team PATCHes teamId', async () => {
    mocks();
    const patch = vi.spyOn(ticketsApi, 'updateTicket').mockResolvedValue(ticket as never);
    render(wrap(<TicketDetail ticketId="t1" go={vi.fn()} addToast={vi.fn()} />));
    await waitFor(() => expect(screen.getByText('Printer offline')).toBeInTheDocument());
    // Team is a custom Popover select: open it (trigger shows 'Unassigned' for a null team), then pick a team.
    const teamRow = screen.getByText('Team').closest('.prop-row') as HTMLElement;
    await userEvent.click(within(teamRow).getByText('Unassigned'));
    await userEvent.click(within(teamRow).getByText('IT Ops'));
    expect(patch).toHaveBeenCalledWith('t1', { teamId: 'team1' });
  });

  it('renders real activity events in the timeline', async () => {
    mocks();
    render(wrap(<TicketDetail ticketId="t1" go={vi.fn()} addToast={vi.fn()} />));
    await waitFor(() => expect(screen.getByText('Printer offline')).toBeInTheDocument());
    expect(screen.getByText(/changed status/i)).toBeInTheDocument();
    expect(screen.getAllByText(/IT Ops/).length).toBeGreaterThan(0);
  });

  it('lists attachments in the Files tab and uploads a file', async () => {
    mocks();
    const up = vi.spyOn(attachmentsApi, 'uploadTicketAttachment').mockResolvedValue({ id: 'att2' } as never);
    render(wrap(<TicketDetail ticketId="t1" go={vi.fn()} addToast={vi.fn()} />));
    await waitFor(() => expect(screen.getByText('Printer offline')).toBeInTheDocument());
    await userEvent.click(screen.getByText('Files'));
    expect(screen.getByText('screenshot.png')).toBeInTheDocument();
    const file = new File(['hi'], 'note.txt', { type: 'text/plain' });
    await userEvent.upload(screen.getByLabelText(/upload file/i), file);
    await waitFor(() => expect(up).toHaveBeenCalledWith('t1', file));
  });

  it('back navigates to the list', async () => {
    mocks();
    const go = vi.fn();
    render(wrap(<TicketDetail ticketId="t1" go={go} addToast={vi.fn()} />));
    await waitFor(() => expect(screen.getByText('Printer offline')).toBeInTheDocument());
    await userEvent.click(screen.getByText('Tickets'));
    expect(go).toHaveBeenCalledWith('tickets');
  });
});
