// SPDX-License-Identifier: AGPL-3.0-only

export type ArticleBlock =
  | { t: 'p'; html: string }
  | { t: 'steps'; items: string[] }
  | { t: 'list'; items: string[] }
  | { t: 'note'; kind: 'tip' | 'warn' | 'info'; html: string };

export interface ArticleSection {
  id: string;
  heading: string;
  blocks: ArticleBlock[];
}

export interface ArticleData {
  body: ArticleSection[];
  excerpt: string;
  tldr: string[];
  categoryGroup: 'IT' | 'HR' | 'FAC';
  category: string;
  relatedArticles: string[];
  linkedForm: string;
  readMin: number;
  tags: string[];
}

export interface CategoryGroup {
  label: string;
  color: string;
  icon: string;
}

export const CATEGORY_GROUPS: Record<string, CategoryGroup> = {
  IT:  { label: 'IT & Software', color: '#2563eb', icon: 'laptop' },
  HR:  { label: 'People & HR',  color: '#16a34a', icon: 'user' },
  FAC: { label: 'Facilities',   color: '#d97706', icon: 'building' },
};

export const CALLOUT_ICON: Record<string, string> = {
  tip: 'checkCircle',
  warn: 'alert',
  info: 'help',
};
