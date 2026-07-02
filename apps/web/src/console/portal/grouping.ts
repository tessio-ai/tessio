// SPDX-License-Identifier: AGPL-3.0-only

import type { PublicFormSummary } from '../../api/portal';
import type { PortalCategory } from '@tessio/shared';

export interface CatalogGroup { category: PortalCategory; items: PublicFormSummary[] }

/** Group published forms under visible categories (ordered); forms whose category
 *  is missing/hidden are returned as `orphans` (rendered under "Other requests"). */
export function groupForms(forms: PublicFormSummary[], categories: PortalCategory[]): { groups: CatalogGroup[]; orphans: PublicFormSummary[] } {
  const cats = categories.filter((c) => c.visible).sort((a, b) => a.order - b.order);
  const catKeys = new Set(cats.map((c) => c.key));
  const groups = cats
    .map((category) => ({ category, items: forms.filter((f) => f.categoryKey === category.key) }))
    .filter((g) => g.items.length > 0);
  const orphans = forms.filter((f) => !catKeys.has(f.categoryKey));
  return { groups, orphans };
}
