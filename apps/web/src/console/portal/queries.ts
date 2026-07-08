// SPDX-License-Identifier: AGPL-3.0-only

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getPublicPortalSettings, listPublicForms, getPublicForm, submitForm, listPublicArticles, getPublicArticle } from '../../api/portal';
import { getTicket, queryTickets } from '../../api/tickets';
import { listTicketActivity } from '../../api/activity';
import { addTicketComment, listTicketComments } from '../../api/comments';

export const usePublicPortalSettings = () => useQuery({ queryKey: ['portal', 'settings'], queryFn: getPublicPortalSettings });
export const usePublicForms = () => useQuery({ queryKey: ['portal', 'forms'], queryFn: listPublicForms });
export const usePublicForm = (key: string | null) =>
  useQuery({ queryKey: ['portal', 'form', key], queryFn: () => getPublicForm(key as string), enabled: !!key });
export const useMyTickets = () => useQuery({ queryKey: ['my-tickets'], queryFn: () => queryTickets() });
export const usePublicArticles = () => useQuery({ queryKey: ['portal', 'kb'], queryFn: listPublicArticles });
export const usePublicArticle = (id: string | null) =>
  useQuery({ queryKey: ['portal', 'kb', id], queryFn: () => getPublicArticle(id as string), enabled: !!id });

/* Requester ticket-progress reads — same endpoints the console uses; the API
   scopes requesters to their own tickets and hides internal comments. */
export const useMyTicket = (id: string) => useQuery({ queryKey: ['my-ticket', id], queryFn: () => getTicket(id) });
export const useMyTicketActivity = (id: string) => useQuery({ queryKey: ['my-ticket', id, 'activity'], queryFn: () => listTicketActivity(id) });
export const useMyTicketComments = (id: string) => useQuery({ queryKey: ['my-ticket', id, 'comments'], queryFn: () => listTicketComments(id) });

export function useReplyToTicket(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => addTicketComment(id, { body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-ticket', id] }),
  });
}

export function useSubmitForm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { key: string; values: Record<string, unknown> }) => submitForm(args.key, args.values),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-tickets'] }),
  });
}
