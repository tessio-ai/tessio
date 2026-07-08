// SPDX-License-Identifier: AGPL-3.0-only

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listTicketLinks, addTicketLink, deleteTicketLink, type CreateLinkInput } from '../../api/links';
import {
  queryTickets,
  getTicket,
  createTicket,
  updateTicket,
  deleteTicket,
  type TicketQuery,
  type CreateTicketInput,
  type UpdateTicketInput,
} from '../../api/tickets';
import { listTicketComments, addTicketComment, type AddCommentInput } from '../../api/comments';
import { listUsers } from '../../api/users';
import { listTeams } from '../../api/teams';
import { listTicketActivity } from '../../api/activity';
import { listTicketAttachments, uploadTicketAttachment, deleteAttachment } from '../../api/attachments';
import { listSchemas } from '../../api/schemas';
import { getTicketTriage, runTicketTriage, getSimilarTickets } from '../../api/ai';
import { getTicketCsat } from '../../api/csat';

export const useTickets = (q: TicketQuery, opts?: { enabled?: boolean }) =>
  useQuery({
    queryKey: ['tickets', q],
    queryFn: () => queryTickets(q),
    enabled: opts?.enabled ?? true,
  });

export const useTicket = (id: string | null) =>
  useQuery({
    queryKey: ['ticket', id],
    queryFn: () => getTicket(id as string),
    enabled: !!id,
  });

export const useTicketSchemas = () =>
  useQuery({
    queryKey: ['schemas', 'ticket'],
    queryFn: () => listSchemas({ kind: 'ticket', status: 'published' }),
  });

export const useUsers = () => useQuery({ queryKey: ['users'], queryFn: listUsers });

export const useTeams = () => useQuery({ queryKey: ['teams'], queryFn: listTeams });

export const useTicketComments = (id: string | null) =>
  useQuery({
    queryKey: ['ticket-comments', id],
    queryFn: () => listTicketComments(id as string),
    enabled: !!id,
  });

export const useTicketActivity = (id: string | null) =>
  useQuery({
    queryKey: ['ticket-activity', id],
    queryFn: () => listTicketActivity(id as string),
    enabled: !!id,
  });

export const useTicketAttachments = (id: string | null) =>
  useQuery({
    queryKey: ['ticket-attachments', id],
    queryFn: () => listTicketAttachments(id as string),
    enabled: !!id,
  });

export function useUploadAttachment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadTicketAttachment(id, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ticket-attachments', id] }),
  });
}

export function useDeleteAttachment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (attId: string) => deleteAttachment(attId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ticket-attachments', id] }),
  });
}

export function useCreateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: CreateTicketInput) => createTicket(b),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tickets'] }),
  });
}

export function useUpdateTicket(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: UpdateTicketInput) => updateTicket(id, b),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ticket', id] });
      qc.invalidateQueries({ queryKey: ['tickets'] });
      qc.invalidateQueries({ queryKey: ['ticket-activity', id] });
    },
  });
}

export function useDeleteTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTicket(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tickets'] }),
  });
}

export function useAddComment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: AddCommentInput) => addTicketComment(id, b),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ticket-comments', id] });
      qc.invalidateQueries({ queryKey: ['ticket-activity', id] });
    },
  });
}

export const useTicketLinks = (id: string | null) =>
  useQuery({ queryKey: ['ticket-links', id], queryFn: () => listTicketLinks(id as string), enabled: !!id });
export function useAddTicketLink(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: CreateLinkInput) => addTicketLink(id, b),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ticket-links', id] });
      qc.invalidateQueries({ queryKey: ['ticket-activity', id] });
    },
  });
}
export function useDeleteTicketLink(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (linkId: string) => deleteTicketLink(id, linkId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ticket-links', id] });
      qc.invalidateQueries({ queryKey: ['ticket-activity', id] });
    },
  });
}

export const useTicketTriage = (ticketId: string | undefined) =>
  useQuery({ queryKey: ['ticket-triage', ticketId], queryFn: () => getTicketTriage(ticketId as string), enabled: !!ticketId });

export function useRunTicketTriage(ticketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => runTicketTriage(ticketId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ticket-triage', ticketId] }),
  });
}

export const useTicketCsat = (ticketId: string | undefined) =>
  useQuery({ queryKey: ['ticket-csat', ticketId], queryFn: () => getTicketCsat(ticketId as string), enabled: !!ticketId });

export const useSimilarTickets = (ticketId: string | undefined, enabled: boolean) =>
  useQuery({
    queryKey: ['ticket-similar', ticketId],
    queryFn: () => getSimilarTickets(ticketId as string),
    enabled: !!ticketId && enabled,
  });
