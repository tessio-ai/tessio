// SPDX-License-Identifier: AGPL-3.0-only

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryArticles, getArticle, createArticle, updateArticle, deleteArticle, listRevisions, getRevision, restoreRevision, type ArticleQuery, type CreateArticleInput, type UpdateArticleInput } from '../../api/kb';
import { listSchemas } from '../../api/schemas';
import { listUsers } from '../../api/users';

export const useArticles = (q: ArticleQuery, opts?: { enabled?: boolean }) =>
  useQuery({ queryKey: ['kb', q], queryFn: () => queryArticles(q), enabled: opts?.enabled ?? true });

export const useArticle = (id: string | null) =>
  useQuery({ queryKey: ['kb-article', id], queryFn: () => getArticle(id as string), enabled: !!id });

export const useKbSchemas = () =>
  useQuery({ queryKey: ['schemas', 'kb_article'], queryFn: () => listSchemas({ kind: 'kb_article', status: 'published' }) });

export function useCreateArticle() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (b: CreateArticleInput) => createArticle(b), onSuccess: () => qc.invalidateQueries({ queryKey: ['kb'] }) });
}

export function useUpdateArticle(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: UpdateArticleInput) => updateArticle(id, b),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kb-article', id] });
      qc.invalidateQueries({ queryKey: ['kb'] });
    },
  });
}

export function useDeleteArticle() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => deleteArticle(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['kb'] }) });
}

export const useRevisions = (id: string | null) =>
  useQuery({ queryKey: ['kb-revisions', id], queryFn: () => listRevisions(id as string), enabled: !!id });

export const useRevision = (id: string | null, revId: string | null) =>
  useQuery({ queryKey: ['kb-revision', id, revId], queryFn: () => getRevision(id as string, revId as string), enabled: !!id && !!revId });

export const useUsers = () => useQuery({ queryKey: ['users'], queryFn: listUsers });

export function useRestoreRevision(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (revId: string) => restoreRevision(id, revId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kb-article', id] });
      qc.invalidateQueries({ queryKey: ['kb-revisions', id] });
    },
  });
}
