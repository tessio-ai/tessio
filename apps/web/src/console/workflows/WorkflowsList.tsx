// SPDX-License-Identifier: AGPL-3.0-only

import { useState } from 'react';
import { Button, EmptyState, relTime } from '../ui';
import { Icon } from '../icons';
import type { Route } from '../shell';
import type { WorkflowListRow } from '../../api/workflows';
import { useWorkflows, useCreateWorkflow, useSetWorkflowStatus } from './queries';

type Go = (screen: string, extra?: Partial<Route>) => void;

const WF_STATUS_TONES: Record<string, { label: string; tone: string }> = {
  draft: { label: 'Draft', tone: 'info' },
  active: { label: 'Active', tone: 'success' },
  paused: { label: 'Paused', tone: 'warning' },
  archived: { label: 'Archived', tone: 'neutral' },
};

export function WorkflowStatusPill({ status }: { status: string }) {
  const meta = WF_STATUS_TONES[status] ?? { label: status, tone: 'neutral' };
  return (
    <span className={'pill pill-' + meta.tone}>
      <span className="dot" />
      {meta.label}
    </span>
  );
}

function RunBadge({ run }: { run: WorkflowListRow['lastRun'] }) {
  if (!run) return <span className="muted">—</span>;
  const tone = { completed: 'success', failed: 'danger', running: 'info', queued: 'info', canceled: 'neutral' }[run.status] ?? 'neutral';
  return (
    <span className={`wf-runbadge tone-${tone}`}>
      {run.status} · {relTime(new Date(run.createdAt).getTime())}
    </span>
  );
}

export function WorkflowsList({ go }: { go: Go }) {
  const { data: workflows, isLoading, isError } = useWorkflows();
  const createWorkflow = useCreateWorkflow();
  const setStatus = useSetWorkflowStatus();
  const [error, setError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  async function onNew() {
    setError(null);
    try {
      const wf = await createWorkflow.mutateAsync({ name: 'New workflow' });
      go('workflows', { workflowId: wf.id });
    } catch (err) {
      const e = err as { detail?: string; message?: string };
      setError(e.detail ?? e.message ?? 'Could not create the workflow.');
    }
  }

  const visible = (workflows ?? []).filter((w) => showArchived || w.status !== 'archived');
  const hasArchived = (workflows ?? []).some((w) => w.status === 'archived');

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="ph-title">Workflows</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {hasArchived && (
            <Button variant="outline" onClick={() => setShowArchived((s) => !s)}>
              {showArchived ? 'Hide archived' : 'Show archived'}
            </Button>
          )}
          <Button variant="primary" icon="plus" onClick={onNew} disabled={createWorkflow.isPending}>
            {createWorkflow.isPending ? 'Creating…' : 'New workflow'}
          </Button>
        </div>
      </div>
      <div className="page-pad">
        {error && <div className="danger inline-error" role="alert">{error}</div>}
        {isLoading && <p className="muted">Loading…</p>}
        {isError && <p className="danger">Failed to load workflows.</p>}
        {workflows && visible.length === 0 && (
          <div className="card" style={{ borderStyle: 'dashed' }}>
            <EmptyState
              icon="workflow"
              title="No workflows yet"
              body="Automate your tickets: trigger on events, branch on conditions, update fields, call APIs, run scripts."
            />
          </div>
        )}
        {visible.length > 0 && (
          <table className="tbl">
            <thead>
              <tr><th>Name</th><th>Status</th><th>Version</th><th>Last run</th><th>Updated</th><th /></tr>
            </thead>
            <tbody>
              {visible.map((w) => (
                <tr key={w.id} className="row-clickable" onClick={() => go('workflows', { workflowId: w.id })}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Icon name="workflow" size={15} style={{ color: 'var(--muted-foreground)' }} />
                      <span>{w.name}</span>
                      {w.hasUnpublishedChanges && <span className="wf-dot" title="Unpublished changes" />}
                    </div>
                  </td>
                  <td><WorkflowStatusPill status={w.status} /></td>
                  <td className="muted">{w.version > 0 ? `v${w.version}` : '—'}</td>
                  <td><RunBadge run={w.lastRun} /></td>
                  <td className="muted">{new Date(w.updatedAt).toLocaleDateString()}</td>
                  <td onClick={(e) => e.stopPropagation()} style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {w.status === 'active' && (
                      <Button size="sm" variant="outline" icon="pause" onClick={() => setStatus.mutate({ id: w.id, status: 'paused' })}>Pause</Button>
                    )}
                    {w.status === 'paused' && (
                      <Button size="sm" variant="outline" icon="play" onClick={() => setStatus.mutate({ id: w.id, status: 'active' })}>Resume</Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
