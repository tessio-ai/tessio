// SPDX-License-Identifier: AGPL-3.0-only

import { request } from './client';
import type { PortalCategory, PortalTheme, PortalHero, PortalCatalogConfig } from '@tessio/shared';

export interface PortalSettingsRow {
  orgId: string;
  brandName: string;
  logo: string | null;
  heroHeadline: string;
  heroIntro: string | null;
  accent: string;
  showTess: boolean;
  categories: PortalCategory[];
  hero: PortalHero;
  catalog: PortalCatalogConfig;
  updatedAt: string;
}

export interface UpdatePortalSettingsInput {
  brandName?: string;
  logo?: string;
  heroHeadline?: string;
  heroIntro?: string;
  accent?: string;
  showTess?: boolean;
  categories?: PortalCategory[];
  hero?: PortalHero;
  catalog?: PortalCatalogConfig;
}

export const getPortalSettings = () => request<PortalSettingsRow>('/portal-settings');
export const updatePortalSettings = (patch: UpdatePortalSettingsInput) =>
  request<PortalSettingsRow>('/portal-settings', { method: 'PATCH', body: JSON.stringify(patch) });

export interface PublicFormSummary {
  key: string;
  name: string;
  description: string | null;
  categoryKey: string;
  icon: string | null;
  theme: PortalTheme;
}
export interface ResolvedField {
  key: string;
  label: string;
  type: string;
  options?: string[];
  config: Record<string, unknown>;
  validation: Record<string, unknown>;
  required: boolean;
  width: 'full' | 'half' | 'third';
  placeholder?: string;
  help?: string;
}
export interface ResolvedForm {
  key: string;
  name: string;
  categoryKey: string;
  icon: string | null;
  theme: PortalTheme;
  sections: { id: string; title: string; fields: ResolvedField[] }[];
}

export const getPublicPortalSettings = () => request<PortalSettingsRow>('/portal/settings');
export const listPublicForms = () => request<PublicFormSummary[]>('/portal/forms');
export const getPublicForm = (key: string) => request<ResolvedForm>(`/portal/forms/${key}`);
export const submitForm = (key: string, values: Record<string, unknown>) =>
  request<{ id: string; number: number | null }>(`/portal/forms/${key}/submit`, { method: 'POST', body: JSON.stringify({ values }) });

export interface PublicArticleSummary {
  id: string;
  title: string;
  slug: string;
  category: string;
  categoryGroup: string;
  excerpt: string;
  readMin: number;
  tags: string[];
  updatedAt: string;
}
export interface PublicArticle {
  id: string;
  title: string;
  slug: string;
  category: string;
  categoryGroup: string;
  tags: string[];
  body: import('../console/knowledge/kb-types').ArticleSection[];
  tldr: string[];
  relatedArticles: string[];
  linkedForm: string;
  readMin: number;
  updatedAt: string;
  authorId: string | null;
}

export const listPublicArticles = (): Promise<PublicArticleSummary[]> => request<PublicArticleSummary[]>('/portal/kb');
export const getPublicArticle = (id: string): Promise<PublicArticle> => request<PublicArticle>(`/portal/kb/${id}`);
