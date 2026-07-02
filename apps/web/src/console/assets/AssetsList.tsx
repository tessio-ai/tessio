// SPDX-License-Identifier: AGPL-3.0-only

import { useMemo, useState } from 'react';
import { Icon } from '../icons';
import { useAssets, useAssetSchemas } from './queries';
import { assetStatusMeta } from './status';
import type { AssetRow } from '../../api/types';

type Go = (screen: string, extra?: { assetId?: string; view?: string }) => void;

export function AssetsList({ go }: { go: Go }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const filter = useMemo(() => {
    const clauses: unknown[] = [];
    if (status) clauses.push({ field: 'status', op: 'eq', value: status });
    if (search.trim()) clauses.push({ field: 'assetTag', op: 'contains', value: search.trim() });
    return clauses.length === 0 ? undefined : clauses.length === 1 ? clauses[0] : { and: clauses };
  }, [search, status]);

  const { data: schemas } = useAssetSchemas();
  const schemaName = (id: string) => schemas?.find((s) => s.id === id)?.name ?? 'Asset';
  const q = useAssets({ filter, limit: 25, sort: { field: 'updatedAt', dir: 'desc' } });
  const rows = q.data?.rows ?? [];
  const name = (a: AssetRow) => (a.data.name as string) || (a.data.title as string) || a.assetTag || 'Untitled asset';

  return (
    <div className="page">
      <div className="page-header">
        <div className="ph-top">
          <h1 className="ph-title">Assets</h1>
          <div className="ph-actions">
            <button className="btn btn-secondary btn-sm" onClick={() => go('assets', { view: 'types' })}>Asset types</button>
            <button className="btn btn-primary btn-sm" onClick={() => go('assets', { view: 'new' })}><Icon name="plus" size={15} />New asset</button>
          </div>
        </div>
      </div>
      <div className="page-pad">
        <div className="toolbar">
          <div className="tb-input"><Icon name="search" size={15} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by tag…" aria-label="Search assets by tag" /></div>
          <div className="seg" role="group" aria-label="Status filter">
            {([['', 'All'], ['in_use', 'In use'], ['in_stock', 'In stock'], ['retired', 'Retired']] as const).map(([v, label]) => (
              <button key={v} type="button" className={(status ?? '') === v ? 'active' : ''} onClick={() => setStatus(v || null)}>{label}</button>
            ))}
          </div>
        </div>
        {q.isLoading ? (
          <div className="tablewrap"><div className="page-pad muted">Loading assets…</div></div>
        ) : q.isError ? (
          <div className="empty"><div className="ei"><Icon name="alert" size={22} /></div><h3>Couldn't load assets</h3><button className="btn btn-secondary btn-sm" onClick={() => q.refetch()}>Try again</button></div>
        ) : rows.length === 0 ? (
          <div className="empty"><div className="ei"><Icon name="box" size={22} /></div><h3>No assets yet</h3><p>Create your first asset to start tracking inventory.</p><button className="btn btn-primary btn-sm" onClick={() => go('assets', { view: 'new' })}>New asset</button></div>
        ) : (
          <div className="tablewrap">
            <table className="tbl">
              <thead><tr><th>Tag</th><th>Name</th><th>Type</th><th>Status</th><th>Location</th></tr></thead>
              <tbody>
                {rows.map((a) => {
                  const meta = assetStatusMeta(a.status);
                  return (
                    <tr key={a.id} onClick={() => go('assets', { assetId: a.id })}>
                      <td className="td-num">{a.assetTag ?? '—'}</td>
                      <td className="td-title"><span className="tt">{name(a)}</span></td>
                      <td>{schemaName(a.schemaId)}</td>
                      <td><span className={`pill pill-${meta.tone}`}><span className="dot" />{meta.label}</span></td>
                      <td>{a.location ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
