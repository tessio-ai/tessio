// SPDX-License-Identifier: AGPL-3.0-only

import type { PortalCategory } from '@tessio/shared';

let counter = 0;
const newKey = () => `cat_${Date.now().toString(36)}_${(counter++).toString(36)}`;

const normalize = (cats: PortalCategory[]): PortalCategory[] => cats.map((c, i) => ({ ...c, order: i }));

export function addCategory(cats: PortalCategory[]): PortalCategory[] {
  return normalize([...cats, { key: newKey(), label: 'New category', icon: 'inbox', color: '#6366f1', order: cats.length, visible: true }]);
}

export function removeCategory(cats: PortalCategory[], index: number): PortalCategory[] {
  return normalize(cats.filter((_, i) => i !== index));
}

export function setCategoryProps(cats: PortalCategory[], index: number, patch: Partial<PortalCategory>): PortalCategory[] {
  return cats.map((c, i) => (i === index ? { ...c, ...patch } : c));
}

export function moveCategory(cats: PortalCategory[], from: number, to: number): PortalCategory[] {
  const next = [...cats];
  const [moved] = next.splice(from, 1);
  if (!moved) return cats;
  next.splice(to, 0, moved);
  return normalize(next);
}
