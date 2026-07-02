// SPDX-License-Identifier: AGPL-3.0-only

import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button, IconButton } from '../../ui';
import type { FormDefinition, FieldWidth, SchemaDefinition } from '@tessio/shared';
import { addField, removeField, setFieldProps, moveField, addSection, renameSection, removeSection, availableKeys } from '../layout-reducer';

const WIDTHS: FieldWidth[] = ['full', 'half', 'third'];

function SortableField({ id, label, width, onWidth, onRemove }: { id: string; label: string; width: FieldWidth; onWidth: (w: FieldWidth) => void; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  return (
    <div ref={setNodeRef} className="layout-field" style={{ transform: CSS.Transform.toString(transform), transition }}>
      <span className="drag-handle" {...attributes} {...listeners} aria-label={`drag ${label}`}>⠿</span>
      <span className="lf-label">{label}</span>
      <label className="lf-width">
        <span className="sr-only">Width for {label}</span>
        <select aria-label={`width for ${label}`} className="select select-sm" value={width} onChange={(e) => onWidth(e.target.value as FieldWidth)}>
          {WIDTHS.map((w) => <option key={w} value={w}>{w}</option>)}
        </select>
      </label>
      <IconButton name="x" title="Remove from form" onClick={onRemove} />
    </div>
  );
}

export function LayoutTab({ definition, schemaDefinition, onChange }: { definition: FormDefinition; schemaDefinition: SchemaDefinition; onChange: (def: FormDefinition) => void }) {
  const labelOf = (key: string) => schemaDefinition.fields.find((f) => f.key === key)?.label ?? key;
  const available = availableKeys(definition, schemaDefinition.fields.map((f) => f.key));

  function onDragEnd(sectionId: string, e: DragEndEvent) {
    const section = definition.sections.find((s) => s.id === sectionId);
    if (!section || !e.over || e.active.id === e.over.id) return;
    const from = section.fields.findIndex((f) => f.fieldKey === e.active.id);
    const to = section.fields.findIndex((f) => f.fieldKey === e.over!.id);
    if (from < 0 || to < 0) return;
    onChange(moveField(definition, sectionId, sectionId, from, to));
  }

  return (
    <div className="layout-tab">
      {definition.sections.map((section) => (
        <div className="layout-section card" key={section.id}>
          <div className="ls-head">
            <input className="input input-ghost" value={section.title} onChange={(e) => onChange(renameSection(definition, section.id, e.target.value))} />
            <IconButton name="x" title="Remove section" onClick={() => onChange(removeSection(definition, section.id))} />
          </div>
          <DndContext collisionDetection={closestCenter} onDragEnd={(e) => onDragEnd(section.id, e)}>
            <SortableContext items={section.fields.map((f) => f.fieldKey)} strategy={verticalListSortingStrategy}>
              {section.fields.map((f) => (
                <SortableField
                  key={f.fieldKey}
                  id={f.fieldKey}
                  label={labelOf(f.fieldKey)}
                  width={f.width}
                  onWidth={(w) => onChange(setFieldProps(definition, section.id, f.fieldKey, { width: w }))}
                  onRemove={() => onChange(removeField(definition, section.id, f.fieldKey))}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      ))}

      <Button variant="outline" size="sm" icon="plus" onClick={() => onChange(addSection(definition, 'New section'))}>Add section</Button>

      {available.length > 0 && (
        <div className="available-fields card">
          <div className="label">Available fields</div>
          {available.map((key) => (
            <div className="af-row" key={key}>
              <span>{labelOf(key)}</span>
              <Button variant="outline" size="sm" icon="plus" onClick={() => onChange(addField(definition, definition.sections[0]?.id ?? 'sec_main', key))} aria-label={`add ${labelOf(key)}`}>Add</Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
