// SPDX-License-Identifier: AGPL-3.0-only

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { IconButton } from '../ui';
import type { PortalCategory } from '@tessio/shared';

export function CategoryRow({ category, onChange, onRemove }: {
  category: PortalCategory;
  onChange: (patch: Partial<PortalCategory>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: category.key });
  return (
    <div ref={setNodeRef} className="cat-row" style={{ transform: CSS.Transform.toString(transform), transition }}>
      <span className="drag-handle" {...attributes} {...listeners} aria-label={`drag ${category.label}`}>⠿</span>
      <input className="input input-sm" aria-label={`label for ${category.key}`} value={category.label} onChange={(e) => onChange({ label: e.target.value })} />
      <input className="input input-sm mono" aria-label={`key for ${category.key}`} value={category.key} onChange={(e) => onChange({ key: e.target.value })} />
      <input className="input input-sm" aria-label={`icon for ${category.key}`} value={category.icon} onChange={(e) => onChange({ icon: e.target.value })} />
      <input type="color" aria-label={`color for ${category.key}`} value={category.color} onChange={(e) => onChange({ color: e.target.value })} />
      <label className="field-check"><input type="checkbox" checked={category.visible} onChange={(e) => onChange({ visible: e.target.checked })} /> Visible</label>
      <IconButton name="x" title="Remove category" onClick={onRemove} />
    </div>
  );
}
