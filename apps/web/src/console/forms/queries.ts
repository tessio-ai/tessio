// SPDX-License-Identifier: AGPL-3.0-only

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listForms, getForm, createForm, updateForm, archiveForm, type CreateFormInput, type UpdateFormInput } from '../../api/forms';
import { getSchema, createSchema, updateSchema, type CreateSchemaInput } from '../../api/schemas';
import type { SchemaDefinition } from '@tessio/shared';
import { getPortalSettings, updatePortalSettings, type UpdatePortalSettingsInput } from '../../api/portal';

export const useForms = () => useQuery({ queryKey: ['forms'], queryFn: listForms });
export const useForm = (id: string) => useQuery({ queryKey: ['form', id], queryFn: () => getForm(id) });
export const useSchema = (id: string | undefined) =>
  useQuery({ queryKey: ['schema', id], queryFn: () => getSchema(id as string), enabled: !!id });

export function useCreateForm() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (b: CreateFormInput) => createForm(b), onSuccess: () => qc.invalidateQueries({ queryKey: ['forms'] }) });
}
export function useCreateSchema() {
  return useMutation({ mutationFn: (b: CreateSchemaInput) => createSchema(b) });
}
export function useUpdateForm(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: UpdateFormInput) => updateForm(id, patch),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['form', id] }); qc.invalidateQueries({ queryKey: ['forms'] }); qc.invalidateQueries({ queryKey: ['schemas'] }); },
  });
}
export function useArchiveForm() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => archiveForm(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['forms'] }) });
}
export function useUpdateSchemaDefinition(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (definition: SchemaDefinition) => updateSchema(id, { definition }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schema', id] }),
  });
}

export const usePortalSettings = () => useQuery({ queryKey: ['portal-settings'], queryFn: getPortalSettings });
export function useUpdatePortalSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: UpdatePortalSettingsInput) => updatePortalSettings(patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portal-settings'] }),
  });
}
