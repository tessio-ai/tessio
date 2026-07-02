// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useMemo, useState } from 'react';
import { FormRenderer } from '@tessio/forms';
import { resolveTemplate } from '@tessio/shared';
import { Icon } from '../icons';
import { useAssetSchemas, useCreateAsset, useUpdateAsset } from './queries';
import type { AssetRow, SchemaRow } from '../../api/types';

const EMPTY_VALUES: Record<string, unknown> = {};

export function AssetDrawer({ onClose, onCreated, asset }: { onClose: () => void; onCreated?: (id: string) => void; asset?: AssetRow }) {
  const { data: schemas } = useAssetSchemas();
  const editing = !!asset;
  const [schemaId, setSchemaId] = useState<string | null>(asset?.schemaId ?? null);
  const [typed, setTyped] = useState({ assetTag: asset?.assetTag ?? '', serial: asset?.serial ?? '', status: asset?.status ?? '', location: asset?.location ?? '' });
  const [nameInput, setNameInput] = useState<string>((asset?.data.name as string) ?? '');
  const [formValues, setFormValues] = useState<Record<string, unknown>>(asset?.data ?? {});
  const create = useCreateAsset();
  const update = useUpdateAsset(asset?.id ?? '');
  useEffect(() => { if (!editing && !schemaId && schemas?.length) setSchemaId(schemas[0].id); }, [schemas, schemaId, editing]);
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [onClose]);
  const schema: SchemaRow | undefined = schemas?.find((s) => s.id === schemaId);
  const customDef = useMemo(() => (schema ? { ...schema.definition, fields: schema.definition.fields.filter((f) => f.key !== 'name') } : undefined), [schema]);

  const liveValues = { ...formValues, asset_tag: typed.assetTag, serial: typed.serial, status: typed.status, location: typed.location };
  const namePreview = schema?.definition.nameTemplate ? resolveTemplate(schema.definition.nameTemplate, liveValues) : '';
  const set = (k: keyof typeof typed, v: string) => setTyped((p) => ({ ...p, [k]: v }));
  const err = (editing ? update.error : create.error) as { detail?: string } | null;

  function submit(formData: Record<string, unknown>) {
    if (!schema) return;
    const data = { ...formData, ...(nameInput.trim() ? { name: nameInput.trim() } : {}) };
    const typedCols = {
      assetTag: typed.assetTag || undefined,
      serial: typed.serial || undefined,
      status: (typed.status || undefined) as 'in_use' | 'in_stock' | 'retired' | undefined,
      location: typed.location || undefined,
    };
    if (editing) update.mutate({ ...typedCols, data }, { onSuccess: () => onClose() });
    else create.mutate({ schemaId: schema.id, schemaVersion: schema.version, ...typedCols, data }, { onSuccess: (row) => { onCreated?.(row.id); onClose(); } });
  }

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="drawer" role="dialog" aria-label={editing ? 'Edit asset' : 'New asset'}>
        <div className="drawer-head">
          <div className="drawer-title">{editing ? 'Edit asset' : 'New asset'}</div>
          <button className="btn-icon" onClick={onClose} aria-label="Close"><Icon name="x" size={16} /></button>
        </div>
        <div className="drawer-body">
          <div className="field">
            <label className="field-label" htmlFor="ad_type">Type</label>
            <select id="ad_type" className="select" value={schemaId ?? ''} disabled={editing} onChange={(e) => setSchemaId(e.target.value)}>
              {(schemas ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="ad_name">Name</label>
            <input id="ad_name" className="input" value={nameInput} onChange={(e) => setNameInput(e.target.value)} placeholder={namePreview || ''} />
            {!nameInput && namePreview && <div className="field-hint">Saved as: {namePreview}</div>}
          </div>
          <div className="form-grid">
            <div className="field"><label className="field-label" htmlFor="ad_tag">Asset tag</label>
              <input id="ad_tag" className="input" value={typed.assetTag} onChange={(e) => set('assetTag', e.target.value)} placeholder={!editing && schema?.definition.tagTemplate ? 'Auto-assigned on save' : ''} /></div>
            <div className="field"><label className="field-label" htmlFor="ad_serial">Serial</label>
              <input id="ad_serial" className="input" value={typed.serial} onChange={(e) => set('serial', e.target.value)} /></div>
            <div className="field"><label className="field-label" htmlFor="ad_status">Status</label>
              <select id="ad_status" className="select" value={typed.status} onChange={(e) => set('status', e.target.value)}>
                <option value="">—</option><option value="in_use">In use</option><option value="in_stock">In stock</option><option value="retired">Retired</option>
              </select></div>
            <div className="field"><label className="field-label" htmlFor="ad_loc">Location</label>
              <input id="ad_loc" className="input" value={typed.location} onChange={(e) => set('location', e.target.value)} /></div>
          </div>
          {err?.detail && <div className="danger inline-error">{err.detail}</div>}
          {schema && customDef && (
            <FormRenderer key={schema.id + (editing ? asset!.id : '')} definition={customDef} value={editing ? asset!.data : EMPTY_VALUES} onSubmit={submit} onValuesChange={setFormValues} submitLabel={editing ? 'Save changes' : 'Create asset'} />
          )}
        </div>
      </div>
    </>
  );
}
