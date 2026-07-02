// SPDX-License-Identifier: AGPL-3.0-only

import { useState } from 'react';
import { Button } from '../../ui';
import type { FieldDef, FieldType } from '@tessio/shared';

const TYPES: FieldType[] = ['text', 'long-text', 'number', 'boolean', 'date', 'select', 'multiselect', 'attachment'];

export function FieldEditor({ initial, existingKeys, onSave, onCancel }: {
  initial?: FieldDef;
  existingKeys: string[];
  onSave: (field: FieldDef) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(initial?.label ?? '');
  const [type, setType] = useState<FieldType>(initial?.type ?? 'text');
  const [required, setRequired] = useState(initial?.required ?? false);
  const [optionsText, setOptionsText] = useState(((initial?.config?.options as string[]) ?? []).join('\n'));
  const isSelect = type === 'select' || type === 'multiselect';

  function slugKey(s: string) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'field';
  }

  function save() {
    let key = initial?.key;
    if (!key) {
      key = slugKey(label);
      let n = 2;
      while (existingKeys.includes(key)) key = `${slugKey(label)}_${n++}`;
    }
    const config = isSelect ? { options: optionsText.split('\n').map((o) => o.trim()).filter(Boolean) } : initial?.config;
    onSave({ key, label, type, required, order: initial?.order ?? 0, width: initial?.width ?? 'full', config });
  }

  return (
    <div className="card field-editor">
      <div className="field">
        <label className="field-label" htmlFor="fe_label">Field label</label>
        <input id="fe_label" className="input" value={label} onChange={(e) => setLabel(e.target.value)} />
      </div>
      <div className="field">
        <label className="field-label" htmlFor="fe_type">Type</label>
        <select id="fe_type" className="select" value={type} onChange={(e) => setType(e.target.value as FieldType)}>
          {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <label className="field-check"><input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} /> Required</label>
      {isSelect && (
        <div className="field">
          <label className="field-label" htmlFor="fe_opts">Options (one per line)</label>
          <textarea id="fe_opts" className="textarea" value={optionsText} onChange={(e) => setOptionsText(e.target.value)} />
        </div>
      )}
      <div className="field-editor-actions">
        <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" size="sm" onClick={save} disabled={!label.trim()}>Save field</Button>
      </div>
    </div>
  );
}
