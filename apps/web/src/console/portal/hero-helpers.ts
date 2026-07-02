// SPDX-License-Identifier: AGPL-3.0-only

import type { PublicFormSummary } from '../../api/portal';
import type { HeroPill } from '@tessio/shared';

export interface HeadlineSeg { text: string; em: boolean }

/** Split a headline into plain/emphasised segments using a single *asterisk* span. */
export function splitHeadline(headline: string): HeadlineSeg[] {
  const m = headline.match(/^(.*?)\*([^*]+)\*(.*)$/);
  if (!m) return [{ text: headline, em: false }];
  const segs: HeadlineSeg[] = [];
  if (m[1]) segs.push({ text: m[1], em: false });
  segs.push({ text: m[2], em: true });
  if (m[3]) segs.push({ text: m[3], em: false });
  return segs;
}

/** Explicit pills win; otherwise auto-pick up to 4 forms (Tess-assisted first). */
export function resolvePills(pills: HeroPill[], forms: PublicFormSummary[]): HeroPill[] {
  if (pills.length) return pills;
  const ranked = [...forms].sort((a, b) => Number(b.theme.showTess) - Number(a.theme.showTess));
  return ranked.slice(0, 4).map((f) => ({ label: f.name, formKey: f.key }));
}
