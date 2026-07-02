// SPDX-License-Identifier: AGPL-3.0-only

import { useState } from 'react';
import { Button, IconButton } from '../../ui';
import type { FieldDef, SchemaDefinition } from '@tessio/shared';
import { useUpdateSchemaDefinition } from '../queries';
import { FieldEditor } from './FieldEditor';

export function FieldsTab({ schemaId, definition }: { schemaId: string; definition: SchemaDefinition }) {
  const [editing, setEditing] = useState<FieldDef | 'new' | null>(null);
  const update = useUpdateSchemaDefinition(schemaId);
  const fields = definition.fields;
  const error = update.error as { detail?: string } | null;

  function persist(next: FieldDef[]) {
    const reordered = next.map((f, i) => ({ ...f, order: i }));
    update.mutate({ ...definition, fields: reordered });
  }

  function saveField(field: FieldDef) {
    const exists = fields.some((f) => f.key === field.key);
    persist(exists ? fields.map((f) => (f.key === field.key ? field : f)) : [...fields, field]);
    setEditing(null);
  }

  return (
    <div className="fields-tab">
      {error?.detail && <div className="danger inline-error">{error.detail}</div>}
      <table className="tbl">
        <thead><tr><th>Label</th><th>Key</th><th>Type</th><th>Required</th><th></th></tr></thead>
        <tbody>
          {fields.map((f) => (
            <tr key={f.key}>
              <td>{f.label}</td>
              <td className="mono">{f.key}</td>
              <td>{f.type}</td>
              <td>{f.required ? 'Yes' : 'No'}</td>
              <td style={{ textAlign: 'right' }}>
                <IconButton name="edit" title="Edit" onClick={() => setEditing(f)} />
                <IconButton name="x" title="Remove" onClick={() => persist(fields.filter((x) => x.key !== f.key))} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {editing ? (
        <FieldEditor
          initial={editing === 'new' ? undefined : editing}
          existingKeys={fields.map((f) => f.key)}
          onSave={saveField}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <Button variant="outline" size="sm" icon="plus" onClick={() => setEditing('new')}>Add field</Button>
      )}
    </div>
  );
}
