// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useState } from 'react';
import { Icon } from '../icons';
import { useAssetSchemas } from './queries';
import { useCreateSchema, useSchema, useUpdateSchemaDefinition } from '../forms/queries';
import { FieldsTab } from '../forms/tabs/FieldsTab';
import type { SchemaRow } from '../../api/types';

type Go = (screen: string, extra?: { view?: string }) => void;

export function AssetTypes({ go }: { go: Go }) {
  const { data: types, refetch } = useAssetSchemas();
  const create = useCreateSchema();
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<SchemaRow | null>(null);

  function add() {
    if (!name.trim()) return;
    create.mutate({ name: name.trim(), kind: 'asset' }, { onSuccess: () => { setName(''); void refetch(); } });
  }

  if (selected) return <TypeEditor schemaId={selected.id} name={selected.name} onBack={() => { setSelected(null); void refetch(); }} />;

  return (
    <div className="page">
      <div className="page-header fe-header">
        <button className="btn-icon" onClick={() => go('assets')} aria-label="Back to assets">
          <Icon name="arrowLeft" size={16} />
        </button>
        <h1 className="ph-title">Asset types</h1>
      </div>
      <div className="page-pad">
        <div className="toolbar">
          <div className="tb-input">
            <input
              placeholder="New type name…"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
              aria-label="New asset type name"
            />
          </div>
          <button className="btn btn-primary btn-sm" onClick={add} disabled={create.isPending}>
            <Icon name="plus" size={15} />Add type
          </button>
        </div>
        <div className="tablewrap">
          <table className="tbl">
            <thead>
              <tr><th>Name</th><th>Fields</th><th>Status</th></tr>
            </thead>
            <tbody>
              {(types ?? []).map((t) => (
                <tr key={t.id} onClick={() => setSelected(t)}>
                  <td className="td-title"><span className="tt">{t.name}</span></td>
                  <td>{t.definition.fields.length}</td>
                  <td><span className="pill pill-neutral">{t.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TypeEditor({ schemaId, name, onBack }: { schemaId: string; name: string; onBack: () => void }) {
  const { data: schema } = useSchema(schemaId);
  const update = useUpdateSchemaDefinition(schemaId);
  const [tagT, setTagT] = useState('');
  const [nameT, setNameT] = useState('');
  useEffect(() => { if (schema) { setTagT(schema.definition.tagTemplate ?? ''); setNameT(schema.definition.nameTemplate ?? ''); } }, [schema]);
  return (
    <div className="page">
      <div className="page-header fe-header">
        <button className="btn-icon" onClick={onBack} aria-label="Back to asset types"><Icon name="arrowLeft" size={16} /></button>
        <h1 className="ph-title">{name}</h1>
      </div>
      <div className="page-pad">
        <div className="card pe-section">
          <div className="label">Naming</div>
          <div className="field"><label className="field-label" htmlFor="nt_tag">Tag pattern</label>
            <input id="nt_tag" className="input" value={tagT} onChange={(e) => setTagT(e.target.value)} placeholder="e.g. ACME-{seq:0000}" /></div>
          <div className="field"><label className="field-label" htmlFor="nt_name">Name pattern</label>
            <input id="nt_name" className="input" value={nameT} onChange={(e) => setNameT(e.target.value)} placeholder="e.g. {manufacturer} {model}" /></div>
          <div className="field-hint">Tokens: {'{asset_tag} {serial} {status} {location}'} and any field key like {'{model}'}. Tag also supports {'{seq}'} / {'{seq:0000}'}.</div>
          <button className="btn btn-secondary btn-sm" disabled={!schema || update.isPending}
            onClick={() => schema && update.mutate({ ...schema.definition, tagTemplate: tagT || undefined, nameTemplate: nameT || undefined })}>Save naming</button>
        </div>
        {schema && <FieldsTab schemaId={schemaId} definition={schema.definition} />}
      </div>
    </div>
  );
}
