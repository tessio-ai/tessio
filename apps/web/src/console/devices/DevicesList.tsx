// SPDX-License-Identifier: AGPL-3.0-only

import { useMemo, useState } from 'react';
import { Icon } from '../icons';
import { relTime } from '../ui';
import { useDevices } from './queries';
import { osLabel, statusTone } from './format';

type Go = (screen: string, extra?: { deviceId?: string; view?: string }) => void;

export function DevicesList({ go }: { go: Go }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  const filter = useMemo(() => {
    const clauses: unknown[] = [];
    if (status) clauses.push({ field: 'status', op: 'eq', value: status });
    if (search.trim()) clauses.push({ field: 'hostname', op: 'contains', value: search.trim() });
    return clauses.length === 0 ? undefined : clauses.length === 1 ? clauses[0] : { and: clauses };
  }, [search, status]);

  const q = useDevices({ filter, limit: 50, sort: { field: 'lastSeenAt', dir: 'desc' } });
  const rows = q.data?.rows ?? [];

  return (
    <div className="page">
      <div className="page-header">
        <div className="ph-top">
          <h1 className="ph-title">Devices</h1>
          <div className="ph-actions">
            <button className="btn btn-secondary btn-sm" onClick={() => go('settings', { view: 'agents' })}>
              <Icon name="lock" size={15} />Agent setup
            </button>
          </div>
        </div>
      </div>
      <div className="page-pad">
        <div className="toolbar">
          <div className="tb-input"><Icon name="search" size={15} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by hostname…" aria-label="Search devices by hostname" /></div>
          <div className="seg" role="group" aria-label="Status filter">
            {([['', 'All'], ['online', 'Online'], ['offline', 'Offline']] as const).map(([v, label]) => (
              <button key={v} type="button" className={(status ?? '') === v ? 'active' : ''} onClick={() => setStatus(v || null)}>{label}</button>
            ))}
          </div>
        </div>
        {q.isLoading ? (
          <div className="tablewrap"><div className="page-pad muted">Loading devices…</div></div>
        ) : q.isError ? (
          <div className="empty"><div className="ei"><Icon name="alert" size={22} /></div><h3>Couldn't load devices</h3><button className="btn btn-secondary btn-sm" onClick={() => q.refetch()}>Try again</button></div>
        ) : rows.length === 0 ? (
          <div className="empty"><div className="ei"><Icon name="laptop" size={22} /></div><h3>No devices yet</h3><p>Install the endpoint agent on a machine to start collecting inventory.</p><button className="btn btn-primary btn-sm" onClick={() => go('settings', { view: 'agents' })}>Agent setup</button></div>
        ) : (
          <div className="tablewrap">
            <table className="tbl">
              <thead><tr><th>Hostname</th><th>OS</th><th>Status</th><th>Model</th><th>Last user</th><th>Last seen</th><th>Linked</th></tr></thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={d.id} onClick={() => go('devices', { deviceId: d.id })}>
                    <td className="td-title"><span className="tt">{d.hostname || '—'}</span></td>
                    <td>{osLabel[d.osType]}{d.osVersion ? ` ${d.osVersion}` : ''}</td>
                    <td><span className={`pill pill-${statusTone(d.status)}`}><span className="dot" />{d.status === 'online' ? 'Online' : 'Offline'}</span></td>
                    <td>{d.model ?? '—'}</td>
                    <td>{d.lastUser ?? '—'}</td>
                    <td>{d.lastSeenAt ? relTime(Date.parse(d.lastSeenAt)) : '—'}</td>
                    <td>{d.linkedAssetId ? <Icon name="link" size={14} /> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
