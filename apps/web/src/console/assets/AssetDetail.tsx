// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useState } from 'react';
import { Icon } from '../icons';
import { useAsset, useAssetComments, useAddComment, useAssetSchemas, useDeleteAsset } from './queries';
import { assetStatusMeta } from './status';
import { RelationshipGraph } from './RelationshipGraph';
import { AssetDrawer } from './AssetDrawer';

type Go = (screen: string, extra?: { assetId?: string }) => void;

export function AssetDetail({ assetId, go }: { assetId: string; go: Go }) {
  const { data: asset, isLoading } = useAsset(assetId);
  const { data: schemas } = useAssetSchemas();
  const [tab, setTab] = useState<'activity' | 'details' | 'linked'>('activity');
  const [editing, setEditing] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  useEffect(() => {
    if (!confirmDel) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setConfirmDel(false); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [confirmDel]);
  const del = useDeleteAsset();
  if (isLoading || !asset) return <div className="page"><div className="page-pad muted">Loading…</div></div>;
  const schema = schemas?.find((s) => s.id === asset.schemaId);
  const name = (asset.data.name as string) || (asset.data.title as string) || asset.assetTag || 'Untitled asset';
  const meta = assetStatusMeta(asset.status);

  return (
    <div className="detail">
      <div className="detail-main">
        <div className="dh">
          <button className="rp-back" onClick={() => go('assets')} aria-label="Back to assets" style={{ marginBottom: 8 }}><Icon name="arrowLeft" size={16} />Assets</button>
          <div className="ph-top">
            <h1 className="dh-title">{name}</h1>
            <div className="ph-actions">
              <button className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}><Icon name="edit" size={14} />Edit</button>
              <button className="btn btn-danger btn-sm" onClick={() => setConfirmDel(true)}>Delete</button>
            </div>
          </div>
          <div className="dh-meta"><span className="td-num">{asset.assetTag ?? '—'}</span><span className={`pill pill-${meta.tone}`}><span className="dot" />{meta.label}</span></div>
        </div>
        <div className="dtabs" role="tablist">
          {(['activity', 'details', 'linked'] as const).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} className={'viewtab' + (tab === t ? ' active' : '')} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)}</button>
          ))}
        </div>
        {tab === 'activity' && <Activity assetId={assetId} />}
        {tab === 'details' && (
          <div className="props page-pad">
            {schema === undefined ? (
              <div className="muted">Loading…</div>
            ) : schema.definition.fields.length === 0 ? (
              <div className="muted">No fields defined.</div>
            ) : (
              schema.definition.fields.map((f) => (
                <div className="prop-row" key={f.key}><div className="prop-label">{f.label}</div><div className="prop-val">{fmt(asset.data[f.key])}</div></div>
              ))
            )}
          </div>
        )}
        {tab === 'linked' && <RelationshipGraph assetId={assetId} assetName={name} go={go} />}
      </div>
      <div className="detail-rail">
        <div className="props">
          <Row label="Status" value={meta.label} />
          <Row label="Serial" value={asset.serial ?? '—'} />
          <Row label="Location" value={asset.location ?? '—'} />
          <Row label="Warranty" value={asset.warrantyExpiresAt ? new Date(asset.warrantyExpiresAt).toLocaleDateString() : '—'} />
        </div>
      </div>
      {editing && <AssetDrawer asset={asset} onClose={() => setEditing(false)} />}
      {confirmDel && (
        <>
          <div className="scrim" onClick={() => setConfirmDel(false)} />
          <div className="dialog" role="dialog" aria-modal="true" aria-label="Delete asset">
            <h3 className="dialog-title">Delete this asset?</h3>
            <p className="muted">This can't be undone from here.</p>
            <div className="dialog-actions">
              <button className="btn btn-secondary btn-sm" autoFocus onClick={() => setConfirmDel(false)}>Cancel</button>
              <button className="btn btn-danger btn-sm" disabled={del.isPending} onClick={() => del.mutate(asset.id, { onSuccess: () => go('assets') })}>Delete asset</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function fmt(v: unknown): string {
  if (v === undefined || v === null || v === '') return '—';
  if (Array.isArray(v)) return v.join(', ');
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="prop-row"><div className="prop-label">{label}</div><div className="prop-val">{value}</div></div>;
}

function Activity({ assetId }: { assetId: string }) {
  const { data: comments } = useAssetComments(assetId);
  const add = useAddComment(assetId);
  const [body, setBody] = useState('');
  return (
    <>
      <div className="timeline">
        {(comments ?? []).map((c) => (
          <div className="tl-item" key={c.id}>
            <div className="tl-ico"><Icon name="message" size={14} /></div>
            <div className="tl-body"><div className="comment">{c.body}</div></div>
          </div>
        ))}
        {(comments ?? []).length === 0 && <div className="muted" style={{ padding: 12 }}>No activity yet.</div>}
      </div>
      <div className="composer">
        <div className="composer-box">
          <textarea
            placeholder="Add a comment…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            aria-label="Add a comment"
          />
        </div>
        <div className="composer-bar">
          <span />
          <button
            className="btn btn-primary btn-sm"
            disabled={!body.trim() || add.isPending}
            onClick={() => {
              add.mutate({ body: body.trim(), internal: false }, { onSuccess: () => setBody('') });
            }}
          >
            Comment
          </button>
        </div>
      </div>
    </>
  );
}
