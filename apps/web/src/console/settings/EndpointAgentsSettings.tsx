// SPDX-License-Identifier: AGPL-3.0-only

import { useState } from 'react';
import { Button } from '../ui';
import { Icon } from '../icons';
import { useEnrollmentKeys, useCreateEnrollmentKey, useRevokeEnrollmentKey, useDevices } from '../devices/queries';
import type { CreatedEnrollmentKey } from '../../api/agent-keys';

export function EndpointAgentsSettings() {
  const { data: keys = [] } = useEnrollmentKeys();
  const create = useCreateEnrollmentKey();
  const revoke = useRevokeEnrollmentKey();
  const devices = useDevices({ limit: 200 });

  const [label, setLabel] = useState('');
  const [justCreated, setJustCreated] = useState<CreatedEnrollmentKey | null>(null);

  const rows = devices.data?.rows ?? [];
  const online = rows.filter((d) => d.status === 'online').length;
  const versions = Array.from(new Set(rows.map((d) => d.agentVersion).filter(Boolean))) as string[];
  const activeKeys = keys.filter((k) => !k.revokedAt);

  const onCreate = () => {
    create.mutate(label.trim() || undefined, {
      onSuccess: (k) => { setJustCreated(k); setLabel(''); },
    });
  };
  const serverUrl = window.location.origin;

  return (
    <>
      <h1 className="set-h">Endpoint agents</h1>
      <p className="set-h-desc">
        Install the agent on workstations and servers to auto-collect hardware, OS, network, and software inventory.
        Devices appear under <b>Devices</b>. Agents enroll once with a key below, then report on their own.
      </p>

      <div className="set-card">
        <div className="set-card-head"><div className="set-card-title">Fleet</div><div className="set-card-sub">Reporting devices right now.</div></div>
        <div className="set-card-body">
          <div className="set-row"><div className="sr-label">Devices</div><div>{rows.length}</div></div>
          <div className="set-row"><div className="sr-label">Online / offline</div><div>{online} online · {rows.length - online} offline</div></div>
          <div className="set-row"><div className="sr-label">Agent versions</div><div>{versions.length ? versions.join(', ') : '—'}</div></div>
        </div>
      </div>

      <div className="set-card">
        <div className="set-card-head"><div className="set-card-title">Enrollment keys</div><div className="set-card-sub">An agent presents one of these on first run. Treat it like a password.</div></div>
        <div className="set-card-body">
          {justCreated && (
            <div className="set-row" style={{ alignItems: 'center', background: 'var(--primary-tint)', borderRadius: 'var(--r-md)', padding: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div className="sr-label">New key — copy it now</div>
                <div className="sr-hint">This is the only time the full key is shown.</div>
                <code style={{ display: 'block', marginTop: 6, wordBreak: 'break-all', fontSize: 'var(--t-small)' }}>{justCreated.key}</code>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button variant="outline" size="sm" icon="copy" onClick={() => navigator.clipboard?.writeText(justCreated.key)}>Copy</Button>
                <Button variant="ghost" size="sm" icon="x" onClick={() => setJustCreated(null)}>Dismiss</Button>
              </div>
            </div>
          )}
          {activeKeys.length === 0 && !justCreated ? (
            <div className="set-row"><span style={{ color: 'var(--muted-foreground)', fontSize: 'var(--t-small)' }}>No active enrollment keys.</span></div>
          ) : (
            activeKeys.map((k) => (
              <div className="set-row" key={k.id} style={{ alignItems: 'center' }}>
                <div>
                  <div className="sr-label">{k.label || 'Enrollment key'}</div>
                  <div className="sr-hint">…{k.hint} · created {new Date(k.createdAt).toLocaleDateString()}</div>
                </div>
                <Button variant="outline" size="sm" icon="trash" disabled={revoke.isPending} onClick={() => revoke.mutate(k.id)}>Revoke</Button>
              </div>
            ))
          )}
        </div>
        <div className="set-card-foot">
          <input className="input" placeholder="Label (optional, e.g. 'Laptops')" value={label} onChange={(e) => setLabel(e.target.value)} style={{ maxWidth: 260 }} />
          <Button variant="primary" size="sm" icon="plus" disabled={create.isPending} onClick={onCreate}>{create.isPending ? 'Creating…' : 'Create key'}</Button>
        </div>
      </div>

      <div className="set-card">
        <div className="set-card-head"><div className="set-card-title">Install</div><div className="set-card-sub">Run on each endpoint with an enrollment key.</div></div>
        <div className="set-card-body">
          <div className="set-row"><div className="sr-label"><Icon name="laptop" size={14} /> Windows</div><div><code>tessio-agent.exe install --server {serverUrl} --key &lt;ENROLLMENT_KEY&gt;</code></div></div>
          <div className="set-row"><div className="sr-label"><Icon name="laptop" size={14} /> macOS</div><div><code>sudo tessio-agent install --server {serverUrl} --key &lt;ENROLLMENT_KEY&gt;</code></div></div>
          <div className="set-row"><div className="sr-label"><Icon name="laptop" size={14} /> Linux</div><div><code>sudo tessio-agent install --server {serverUrl} --key &lt;ENROLLMENT_KEY&gt;</code></div></div>
        </div>
      </div>
    </>
  );
}
