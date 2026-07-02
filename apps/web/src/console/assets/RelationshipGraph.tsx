// SPDX-License-Identifier: AGPL-3.0-only

import { useMemo, useState, type KeyboardEvent } from 'react';
import { Icon } from '../icons';
import { useAssetLinks, useAddLink, useAssets } from './queries';
import { layoutRadial, type GraphNodeInput } from './graph-layout';
import type { LinkRow } from '../../api/types';

type Go = (screen: string, extra?: { assetId?: string }) => void;
const W = 460, H = 360, R = 130;
const KIND_COLOR: Record<string, string> = { asset: '#2563eb', ticket: '#d97706', kb_article: '#16a34a', form_submission: '#8b5cf6' };

export function RelationshipGraph({ assetId, assetName, go }: { assetId: string; assetName: string; go: Go }) {
  const { data: links } = useAssetLinks(assetId);
  const [adding, setAdding] = useState(false);
  const inputs: GraphNodeInput[] = useMemo(
    () => (links ?? []).map((l: LinkRow) => {
      // listAssetLinks may return links in either direction; show the record on the OTHER end.
      const other = l.fromId === assetId ? { id: l.toId, kind: l.toType } : { id: l.fromId, kind: l.fromType };
      return { id: other.id, linkId: l.id, label: other.id.slice(0, 6), kind: other.kind, relationship: l.relationshipType };
    }),
    [links, assetId],
  );
  const { center, nodes } = layoutRadial(inputs, { width: W, height: H, radius: R });
  const groups = useMemo(() => {
    const m = new Map<string, GraphNodeInput[]>();
    inputs.forEach((nd) => { const a = m.get(nd.relationship) ?? []; a.push(nd); m.set(nd.relationship, a); });
    return [...m.entries()];
  }, [inputs]);

  const navigate = (kind: string, id: string) => { if (kind === 'asset') go('assets', { assetId: id }); };

  return (
    <div className="page-pad rel-graph">
      <div className="rel-head"><span className="rail-sect">Relationships</span><button className="btn btn-secondary btn-sm" onClick={() => setAdding((a) => !a)}><Icon name="plus" size={14} />Add link</button></div>
      {adding && <AddLinkForm assetId={assetId} onDone={() => setAdding(false)} />}
      {inputs.length === 0 ? (
        <div className="empty"><div className="ei"><Icon name="gitMerge" size={22} /></div><h3>No links yet</h3><p>Connect this asset to related records.</p></div>
      ) : (
        <>
          <svg className="rel-svg" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
            {nodes.map((nd) => <line key={`e-${nd.linkId}`} x1={center.x} y1={center.y} x2={nd.x} y2={nd.y} stroke="var(--border-strong)" strokeWidth={1.5} />)}
            <g><circle cx={center.x} cy={center.y} r={26} fill="var(--primary)" /><text x={center.x} y={center.y + 4} textAnchor="middle" fontSize="11" fill="#fff">{assetName.slice(0, 8)}</text></g>
            {nodes.map((nd) => (
              <g key={nd.linkId} style={{ cursor: nd.kind === 'asset' ? 'pointer' : 'default' }} onClick={() => navigate(nd.kind, nd.id)}>
                <circle cx={nd.x} cy={nd.y} r={20} fill={KIND_COLOR[nd.kind] ?? '#6b7280'} />
                <text x={nd.x} y={nd.y + 4} textAnchor="middle" fontSize="10" fill="#fff">{nd.label}</text>
              </g>
            ))}
          </svg>
          <div className="rel-list">
            {groups.map(([rel, items]) => (
              <div className="rel-group" key={rel}>
                <div className="rel-rel">{rel}</div>
                {items.map((it) => (
                  <button type="button" className="rel-row" key={it.linkId} onClick={() => navigate(it.kind, it.id)}>
                    <span className="rel-dot" style={{ background: KIND_COLOR[it.kind] ?? '#6b7280' }} />
                    <span className="rel-kind">{it.kind}</span><span className="rel-id">{it.label}</span>
                    <Icon name="arrowRight" size={14} />
                  </button>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function AddLinkForm({ assetId, onDone }: { assetId: string; onDone: () => void }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [rel, setRel] = useState('depends_on');
  const enabled = q.length > 1;
  const { data } = useAssets({ filter: { field: 'assetTag', op: 'contains', value: q }, limit: 5 }, { enabled });
  const add = useAddLink(assetId);
  const results = enabled ? (data?.rows ?? []) : [];

  function choose(id: string) { add.mutate({ toType: 'asset', toId: id, relationshipType: rel }, { onSuccess: onDone }); setOpen(false); }
  function onKey(e: KeyboardEvent) {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(results[active].id); }
    else if (e.key === 'Escape') setOpen(false);
  }

  return (
    <div className="card pe-section">
      <div className="form-grid">
        <div className="field" style={{ position: 'relative' }}>
          <label className="field-label" htmlFor="al_q">Find asset</label>
          <input id="al_q" className="input" role="combobox" aria-expanded={open && results.length > 0} aria-controls="al_listbox" aria-autocomplete="list"
            aria-activedescendant={open && results.length > 0 ? `al_opt_${results[active].id}` : undefined}
            value={q} placeholder="Asset tag…" onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0); }} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onKeyDown={onKey} />
          {open && results.length > 0 && (
            <ul id="al_listbox" role="listbox" className="combo-list">
              {results.map((a, i) => (
                <li key={a.id} id={`al_opt_${a.id}`} role="option" aria-selected={i === active} className={'combo-opt' + (i === active ? ' active' : '')}
                  onMouseDown={(e) => { e.preventDefault(); choose(a.id); }}>{a.assetTag ?? a.id.slice(0, 6)}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="field"><label className="field-label" htmlFor="al_rel">Relationship</label>
          <select id="al_rel" className="select" value={rel} onChange={(e) => setRel(e.target.value)}>
            <option value="depends_on">depends_on</option><option value="runs_on">runs_on</option><option value="connected_to">connected_to</option>
          </select></div>
      </div>
    </div>
  );
}
