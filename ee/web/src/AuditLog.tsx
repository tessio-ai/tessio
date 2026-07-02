// SPDX-License-Identifier: LicenseRef-Tessio-Commercial

import { useState, useEffect } from 'react';
import { AUDIT_ACTIONS, AUDIT_ACTION_LABELS } from '@tessio/shared';
import { useEeHost } from '@tessio/web-ee-host';

interface AuditRow {
  id: string;
  actorEmail: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown>;
  ip: string | null;
  createdAt: string;
}

interface AuditPage {
  items: AuditRow[];
  nextBefore: string | null;
}

export function AuditLog() {
  const { Button, relTime, absTime, request } = useEeHost();

  const getAuditLog = (params: { action?: string; before?: string; limit?: number } = {}): Promise<AuditPage> => {
    const qs = new URLSearchParams();
    if (params.action) qs.set('action', params.action);
    if (params.before) qs.set('before', params.before);
    if (params.limit != null) qs.set('limit', String(params.limit));
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return request<AuditPage>(`/audit-log${suffix}`);
  };

  const [action, setAction] = useState('');
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = (actionFilter: string) => {
    setLoading(true);
    setError(null);
    getAuditLog({ action: actionFilter || undefined })
      .then((page) => {
        setRows(page.items);
        setNextBefore(page.nextBefore);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load audit log'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(action);
  }, [action]);

  const loadMore = () => {
    if (!nextBefore) return;
    setLoadingMore(true);
    getAuditLog({ action: action || undefined, before: nextBefore })
      .then((page) => {
        setRows((prev) => [...prev, ...page.items]);
        setNextBefore(page.nextBefore);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load more'))
      .finally(() => setLoadingMore(false));
  };

  return (
    <>
      <h1 className="set-h">Audit log</h1>
      <p className="set-h-desc">An append-only record of administrative and authentication events across the workspace.</p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <select
          className="select"
          value={action}
          onChange={(e) => setAction(e.target.value)}
          style={{ minWidth: 200 }}
        >
          <option value="">All actions</option>
          {AUDIT_ACTIONS.map((a) => (
            <option key={a} value={a}>{AUDIT_ACTION_LABELS[a] ?? a}</option>
          ))}
        </select>
      </div>

      {loading && <p className="muted">Loading…</p>}
      {error && <p className="danger">{error}</p>}

      {!loading && !error && rows.length === 0 && (
        <div className="set-card">
          <div className="set-card-body" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--muted-foreground)', fontSize: 'var(--t-small)' }}>
            No audit events found.
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <div className="tablewrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Time</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Target</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const ts = new Date(r.createdAt).getTime();
                const target = r.targetType
                  ? r.targetType + (r.targetId ? ' #' + r.targetId.slice(0, 8) : '')
                  : '—';
                return (
                  <tr key={r.id}>
                    <td className="muted" title={absTime(ts)}>{relTime(ts)}</td>
                    <td>{r.actorEmail || '—'}</td>
                    <td>{AUDIT_ACTION_LABELS[r.action] ?? r.action}</td>
                    <td className="muted">{target}</td>
                    <td className="muted">{r.ip ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {nextBefore && (
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      )}
    </>
  );
}
