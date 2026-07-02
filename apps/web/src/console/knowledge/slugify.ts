// SPDX-License-Identifier: AGPL-3.0-only

/** URL/anchor-safe slug: lowercase, alnum + hyphens, collapsed/trimmed. */
export function slugify(text: string): string {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
