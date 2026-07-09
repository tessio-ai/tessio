// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { RequesterPortal } from '../portal';
import * as portalApi from '../../api/portal';
import * as ticketsApi from '../../api/tickets';
import * as csatApi from '../../api/csat';
import * as activityApi from '../../api/activity';
import * as commentsApi from '../../api/comments';
import * as authCtx from '../../auth/AuthContext';

function wrap(node: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{node}</QueryClientProvider>;
}
beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(authCtx, 'useAuth').mockReturnValue({ user: { id: 'u1', email: 'd@a.io', name: 'Dana Lee', role: 'requester' }, loading: false, login: vi.fn(), logout: vi.fn() } as never);
  vi.spyOn(portalApi, 'getPublicPortalSettings').mockResolvedValue({ orgId: 'o', brandName: 'Acme', logo: 'A', heroHeadline: 'How can we help?', heroIntro: '', accent: '#4f46e5', showTess: true, categories: [], updatedAt: '', hero: { preset: 'spotlight', pills: [], showSearch: true }, catalog: { sectionStyle: 'band', cardStyle: 'comfortable', columns: 'auto' } } as never);
  vi.spyOn(portalApi, 'listPublicForms').mockResolvedValue([] as never);
});
afterEach(() => vi.restoreAllMocks());

describe('RequesterPortal', () => {
  it('renders the catalog with the brand and greets the user', async () => {
    render(wrap(<RequesterPortal />));
    await waitFor(() => expect(screen.getByText(/how can we help/i)).toBeInTheDocument());
    expect(screen.getByText('Acme')).toBeInTheDocument();
  });

  it('My requests nav shows the requester tickets', async () => {
    vi.spyOn(ticketsApi, 'queryTickets').mockResolvedValue({ rows: [{ id: 't1', number: 7, status: 'open', priority: null, requesterId: null, assigneeId: null, teamId: null, dueAt: null, schemaId: 's1', schemaVersion: 1, data: { title: 'Printer' }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), formId: 'f1' }], nextCursor: null } as never);
    render(wrap(<RequesterPortal />));
    await userEvent.click(await screen.findByText(/my requests/i));
    await waitFor(() => expect(screen.getByText('Printer')).toBeInTheDocument());
    expect(screen.getByText(/#7/)).toBeInTheDocument();
  });

  it('shows a satisfaction prompt on resolved tickets and submits a rating', async () => {
    vi.spyOn(ticketsApi, 'queryTickets').mockResolvedValue({ rows: [{ id: 't1', number: 7, status: 'resolved', priority: null, requesterId: 'u1', assigneeId: null, teamId: null, dueAt: null, schemaId: 's1', schemaVersion: 1, data: { title: 'Printer' }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), formId: 'f1' }], nextCursor: null } as never);
    vi.spyOn(csatApi, 'getMyCsat').mockResolvedValue({ enabled: true, question: 'Happy with the fix?', responses: [] });
    const submit = vi.spyOn(csatApi, 'submitCsat').mockResolvedValue({ ticketId: 't1', rating: 4, comment: null, sentAt: '', respondedAt: new Date().toISOString() });

    render(wrap(<RequesterPortal />));
    await userEvent.click(await screen.findByText(/my requests/i));
    await waitFor(() => expect(screen.getByText('Happy with the fix?')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('radio', { name: '4 of 5' }));
    await userEvent.click(screen.getByRole('button', { name: /send feedback/i }));
    await waitFor(() => expect(submit).toHaveBeenCalledWith('t1', 4, undefined));
  });

  it('shows the thanks state instead of the prompt once rated', async () => {
    vi.spyOn(ticketsApi, 'queryTickets').mockResolvedValue({ rows: [{ id: 't1', number: 7, status: 'closed', priority: null, requesterId: 'u1', assigneeId: null, teamId: null, dueAt: null, schemaId: 's1', schemaVersion: 1, data: { title: 'Printer' }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), formId: 'f1' }], nextCursor: null } as never);
    vi.spyOn(csatApi, 'getMyCsat').mockResolvedValue({ enabled: true, question: null, responses: [{ ticketId: 't1', rating: 5, comment: 'great', sentAt: '', respondedAt: new Date().toISOString() }] });

    render(wrap(<RequesterPortal />));
    await userEvent.click(await screen.findByText(/my requests/i));
    await waitFor(() => expect(screen.getByText(/you rated this 5\/5/i)).toBeInTheDocument());
  });

  it('shows no satisfaction prompt when surveys are disabled', async () => {
    vi.spyOn(ticketsApi, 'queryTickets').mockResolvedValue({ rows: [{ id: 't1', number: 7, status: 'resolved', priority: null, requesterId: 'u1', assigneeId: null, teamId: null, dueAt: null, schemaId: 's1', schemaVersion: 1, data: { title: 'Printer' }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), formId: 'f1' }], nextCursor: null } as never);
    vi.spyOn(csatApi, 'getMyCsat').mockResolvedValue({ enabled: false, question: null, responses: [] });

    render(wrap(<RequesterPortal />));
    await userEvent.click(await screen.findByText(/my requests/i));
    await waitFor(() => expect(screen.getByText('Printer')).toBeInTheDocument());
    expect(screen.queryByRole('radiogroup', { name: /rating/i })).not.toBeInTheDocument();
  });

  it('opens a request from My requests and shows its progress', async () => {
    vi.spyOn(ticketsApi, 'queryTickets').mockResolvedValue({ rows: [{ id: 't1', number: 7, status: 'in_progress', priority: null, requesterId: 'u1', assigneeId: null, teamId: null, dueAt: null, schemaId: 's1', schemaVersion: 1, data: { title: 'Printer' }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), formId: 'f1' }], nextCursor: null } as never);
    vi.spyOn(ticketsApi, 'getTicket').mockResolvedValue({ id: 't1', number: 7, status: 'in_progress', priority: null, requesterId: 'u1', assigneeId: null, teamId: null, dueAt: null, schemaId: 's1', schemaVersion: 1, data: { title: 'Printer' }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), formId: 'f1' } as never);
    vi.spyOn(activityApi, 'listTicketActivity').mockResolvedValue([{ id: 'a1', actorId: 'u1', eventType: 'created', changes: null, createdAt: new Date().toISOString() }]);
    vi.spyOn(commentsApi, 'listTicketComments').mockResolvedValue([]);
    render(wrap(<RequesterPortal />));
    await userEvent.click(await screen.findByText(/my requests/i));
    await userEvent.click(await screen.findByText('Printer'));
    await waitFor(() => expect(screen.getByRole('list', { name: /request progress/i })).toBeInTheDocument());
    expect(screen.getByText('Request submitted')).toBeInTheDocument();
  });

  it('renders the spotlight hero by default', async () => {
    render(wrap(<RequesterPortal />));
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument());
    expect(document.querySelector('.rp-hero')?.getAttribute('data-preset')).toBe('spotlight');
  });
});
