// SPDX-License-Identifier: AGPL-3.0-only

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getPublicPortalSettings, listPublicForms, getPublicForm, submitForm, listPublicArticles, getPublicArticle } from '../../api/portal';
import { queryTickets } from '../../api/tickets';

export const usePublicPortalSettings = () => useQuery({ queryKey: ['portal', 'settings'], queryFn: getPublicPortalSettings });
export const usePublicForms = () => useQuery({ queryKey: ['portal', 'forms'], queryFn: listPublicForms });
export const usePublicForm = (key: string | null) =>
  useQuery({ queryKey: ['portal', 'form', key], queryFn: () => getPublicForm(key as string), enabled: !!key });
export const useMyTickets = () => useQuery({ queryKey: ['my-tickets'], queryFn: () => queryTickets() });
export const usePublicArticles = () => useQuery({ queryKey: ['portal', 'kb'], queryFn: listPublicArticles });
export const usePublicArticle = (id: string | null) =>
  useQuery({ queryKey: ['portal', 'kb', id], queryFn: () => getPublicArticle(id as string), enabled: !!id });

export function useSubmitForm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { key: string; values: Record<string, unknown> }) => submitForm(args.key, args.values),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-tickets'] }),
  });
}
