// SPDX-License-Identifier: AGPL-3.0-only

import { useState } from 'react';
import { Icon } from '../icons';
import { relTime } from '../ui';
import { useDevice, useDeleteDevice, useLinkDevice, useUnlinkDevice } from './queries';
import { useAssets } from '../assets/queries';
import { osLabel, fmtBytes, statusTone } from './format';

type Go = (screen: string, extra?: { deviceId?: string; assetId?: string }) => void;

interface NetIface { name: string; mac?: string | null; ipv4?: string[]; ipv6?: string[] }
interface Disk { name: string; fsType?: string | null; totalBytes: number; availableBytes?: number | null }

export function DeviceDetail({ deviceId, go }: { deviceId: string; go: Go }) {
  const { data: device, isLoading } = useDevice(deviceId);
  const [tab, setTab] = useState<'hardware' | 'network' | 'software'>('hardware');
  const [confirmDel, setConfirmDel] = useState(false);
  const [linking, setLinking] = useState(false);
  const del = useDeleteDevice();
  const link = useLinkDevice(deviceId);
  const unlink = useUnlinkDevice(deviceId);

  if (isLoading || !device) return <div className="page"><div className="page-pad muted">Loading…</div></div>;

  const ifaces = (device.data.interfaces as NetIface[] | undefined) ?? [];
  const disks = (device.data.disks as Disk[] | undefined) ?? [];

  return (
    <div className="detail">
      <div className="detail-main">
        <div className="dh">
          <button className="rp-back" onClick={() => go('devices')} aria-label="Back to devices" style={{ marginBottom: 8 }}><Icon name="arrowLeft" size={16} />Devices</button>
          <div className="ph-top">
            <h1 className="dh-title">{device.hostname || 'Unknown device'}</h1>
            <div className="ph-actions">
              {device.linkedAssetId ? (
                <>
                  <button className="btn btn-secondary btn-sm" onClick={() => go('assets', { assetId: device.linkedAssetId! })}><Icon name="box" size={14} />View asset</button>
                  <button className="btn btn-secondary btn-sm" disabled={unlink.isPending} onClick={() => unlink.mutate()}>Unlink</button>
                </>
              ) : (
                <button className="btn btn-secondary btn-sm" onClick={() => setLinking(true)}><Icon name="link" size={14} />Link to asset</button>
              )}
              <button className="btn btn-danger btn-sm" onClick={() => setConfirmDel(true)}>Decommission</button>
            </div>
          </div>
          <div className="dh-meta">
            <span className={`pill pill-${statusTone(device.status)}`}><span className="dot" />{device.status === 'online' ? 'Online' : 'Offline'}</span>
            <span className="td-num">{osLabel[device.osType]}{device.osVersion ? ` ${device.osVersion}` : ''}</span>
          </div>
        </div>
        <div className="dtabs" role="tablist">
          {(['hardware', 'network', 'software'] as const).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} className={'viewtab' + (tab === t ? ' active' : '')} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)}</button>
          ))}
        </div>

        {tab === 'hardware' && (
          <div className="props page-pad">
            <Row label="Manufacturer" value={device.manufacturer ?? '—'} />
            <Row label="Model" value={device.model ?? '—'} />
            <Row label="Serial" value={device.serial ?? '—'} />
            <Row label="CPU" value={device.cpu ? `${device.cpu}${device.cpuCores ? ` (${device.cpuCores} cores)` : ''}` : '—'} />
            <Row label="Memory" value={fmtBytes(device.ramBytes)} />
            <Row label="BIOS/firmware" value={(device.data.biosVersion as string) || '—'} />
            {disks.length > 0 && (
              <div className="prop-row"><div className="prop-label">Disks</div><div className="prop-val">
                {disks.map((d, i) => <div key={i}>{d.name}{d.fsType ? ` (${d.fsType})` : ''} — {fmtBytes(d.totalBytes)}{d.availableBytes != null ? `, ${fmtBytes(d.availableBytes)} free` : ''}</div>)}
              </div></div>
            )}
          </div>
        )}

        {tab === 'network' && (
          <div className="page-pad">
            {ifaces.length === 0 ? <div className="muted">No network interfaces reported.</div> : (
              <table className="tbl">
                <thead><tr><th>Interface</th><th>MAC</th><th>IPv4</th><th>IPv6</th></tr></thead>
                <tbody>
                  {ifaces.map((n, i) => (
                    <tr key={i}><td className="td-title">{n.name}</td><td>{n.mac ?? '—'}</td><td>{(n.ipv4 ?? []).join(', ') || '—'}</td><td>{(n.ipv6 ?? []).join(', ') || '—'}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'software' && (
          <div className="page-pad">
            {device.software.length === 0 ? <div className="muted">No software reported.</div> : (
              <table className="tbl">
                <thead><tr><th>Name</th><th>Version</th><th>Publisher</th><th>Installed</th></tr></thead>
                <tbody>
                  {device.software.map((s, i) => (
                    <tr key={i}><td className="td-title">{s.name}</td><td>{s.version ?? '—'}</td><td>{s.publisher ?? '—'}</td><td>{s.installedAt ? new Date(s.installedAt).toLocaleDateString() : '—'}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      <div className="detail-rail">
        <div className="props">
          <Row label="Status" value={device.status === 'online' ? 'Online' : 'Offline'} />
          <Row label="Last user" value={device.lastUser ?? '—'} />
          <Row label="Last seen" value={device.lastSeenAt ? relTime(Date.parse(device.lastSeenAt)) : '—'} />
          <Row label="Last report" value={device.lastReportAt ? relTime(Date.parse(device.lastReportAt)) : '—'} />
          <Row label="First seen" value={device.firstSeenAt ? new Date(device.firstSeenAt).toLocaleDateString() : '—'} />
          <Row label="OS build" value={device.osBuild ?? '—'} />
          <Row label="Agent" value={device.agentVersion ?? '—'} />
          <Row label="Machine ID" value={device.machineId} />
        </div>
      </div>

      {linking && <LinkAssetDialog onClose={() => setLinking(false)} onPick={(assetId) => link.mutate(assetId, { onSuccess: () => setLinking(false) })} />}
      {confirmDel && (
        <>
          <div className="scrim" onClick={() => setConfirmDel(false)} />
          <div className="dialog" role="dialog" aria-modal="true" aria-label="Decommission device">
            <h3 className="dialog-title">Decommission this device?</h3>
            <p className="muted">It will be removed from the inventory. If the agent reports again, it will re-appear.</p>
            <div className="dialog-actions">
              <button className="btn btn-secondary btn-sm" autoFocus onClick={() => setConfirmDel(false)}>Cancel</button>
              <button className="btn btn-danger btn-sm" disabled={del.isPending} onClick={() => del.mutate(device.id, { onSuccess: () => go('devices') })}>Decommission</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="prop-row"><div className="prop-label">{label}</div><div className="prop-val">{value}</div></div>;
}

function LinkAssetDialog({ onClose, onPick }: { onClose: () => void; onPick: (assetId: string) => void }) {
  const [search, setSearch] = useState('');
  const q = useAssets({ limit: 50, sort: { field: 'updatedAt', dir: 'desc' } });
  const rows = (q.data?.rows ?? []).filter((a) => {
    const name = (a.data.name as string) || a.assetTag || '';
    return !search.trim() || (name + ' ' + (a.serial ?? '')).toLowerCase().includes(search.trim().toLowerCase());
  });
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="dialog" role="dialog" aria-modal="true" aria-label="Link to asset" style={{ width: 480, maxWidth: '92vw' }}>
        <h3 className="dialog-title">Link to an asset</h3>
        <div className="tb-input" style={{ margin: '8px 0' }}><Icon name="search" size={15} /><input autoFocus placeholder="Search assets…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <div style={{ maxHeight: 280, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--r-md)' }}>
          {rows.length === 0 ? <div className="muted" style={{ padding: 12 }}>No matching assets.</div> : (
            <table className="tbl" style={{ width: '100%' }}>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id} onClick={() => onPick(a.id)} style={{ cursor: 'pointer' }}>
                    <td className="td-num">{a.assetTag ?? '—'}</td>
                    <td className="td-title">{(a.data.name as string) || (a.data.title as string) || 'Untitled asset'}</td>
                    <td>{a.serial ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="dialog-actions"><button className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button></div>
      </div>
    </>
  );
}
