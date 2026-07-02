// SPDX-License-Identifier: AGPL-3.0-only

import { request } from './client';
import type { FormDefinition, PortalTheme } from '@tessio/shared';

export type FormStatus = 'draft' | 'published' | 'archived';

export interface FormRow {
  id: string;
  orgId: string;
  key: string;
  name: string;
  description: string | null;
  icon: string | null;
  categoryKey: string;
  targetSchemaId: string;
  status: FormStatus;
  theme: PortalTheme;
  definition: FormDefinition;
  createdAt: string;
  updatedAt: string;
}

export type CreateThemeInput = Pick<PortalTheme, 'accent' | 'headline'> & Partial<Omit<PortalTheme, 'accent' | 'headline'>>;

export interface CreateFormInput {
  key: string;
  name: string;
  categoryKey: string;
  targetSchemaId: string;
  icon?: string;
  description?: string;
  status?: FormStatus;
  theme: CreateThemeInput;
  definition?: FormDefinition;
}

export interface UpdateFormInput {
  name?: string;
  key?: string;
  description?: string;
  icon?: string;
  categoryKey?: string;
  status?: FormStatus;
  theme?: PortalTheme;
  definition?: FormDefinition;
}

export const listForms = () => request<FormRow[]>('/forms');
export const getForm = (id: string) => request<FormRow>(`/forms/${id}`);
export const createForm = (b: CreateFormInput) => request<FormRow>('/forms', { method: 'POST', body: JSON.stringify(b) });
export const updateForm = (id: string, patch: UpdateFormInput) => request<FormRow>(`/forms/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
export const archiveForm = (id: string) => request<FormRow>(`/forms/${id}`, { method: 'DELETE' });
