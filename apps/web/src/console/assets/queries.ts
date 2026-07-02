// SPDX-License-Identifier: AGPL-3.0-only

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryAssets, getAsset, createAsset, updateAsset, deleteAsset, type AssetQuery, type CreateAssetInput, type UpdateAssetInput } from '../../api/assets';
import { listAssetLinks, addAssetLink, type CreateLinkInput } from '../../api/links';
import { listAssetComments, addAssetComment, type AddCommentInput } from '../../api/comments';
import { listSchemas } from '../../api/schemas';

export const useAssets = (q: AssetQuery, opts?: { enabled?: boolean }) =>
  useQuery({ queryKey: ['assets', q], queryFn: () => queryAssets(q), enabled: opts?.enabled ?? true });
export const useAsset = (id: string | null) => useQuery({ queryKey: ['asset', id], queryFn: () => getAsset(id as string), enabled: !!id });
export const useAssetSchemas = () => useQuery({ queryKey: ['schemas', 'asset'], queryFn: () => listSchemas({ kind: 'asset', status: 'published' }) });
export const useAssetComments = (id: string | null) => useQuery({ queryKey: ['asset-comments', id], queryFn: () => listAssetComments(id as string), enabled: !!id });
export const useAssetLinks = (id: string | null) => useQuery({ queryKey: ['asset-links', id], queryFn: () => listAssetLinks(id as string), enabled: !!id });

export function useCreateAsset() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (b: CreateAssetInput) => createAsset(b), onSuccess: () => qc.invalidateQueries({ queryKey: ['assets'] }) });
}

export function useUpdateAsset(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: UpdateAssetInput) => updateAsset(id, b),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['asset', id] });
      qc.invalidateQueries({ queryKey: ['assets'] });
    },
  });
}

export function useAddComment(id: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (b: AddCommentInput) => addAssetComment(id, b), onSuccess: () => qc.invalidateQueries({ queryKey: ['asset-comments', id] }) });
}

export function useAddLink(id: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (b: CreateLinkInput) => addAssetLink(id, b), onSuccess: () => qc.invalidateQueries({ queryKey: ['asset-links', id] }) });
}

export function useDeleteAsset() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => deleteAsset(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['assets'] }) });
}
