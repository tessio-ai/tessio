// SPDX-License-Identifier: AGPL-3.0-only

import { Button, EmptyState, IconButton, absTime } from '../ui';
import type { Route } from '../shell';
import type { WorkflowRunRow } from '../../api/workflows';
import { useWorkflow, useWorkflowRuns } from './queries';
import './workflows.css';

type Go = (screen: string, extra?: Partial<Route>) => void;

export function RunStatusPill({ status }: { status: string }) {
  const tone = { completed: 'success', failed: 'danger', running: 'info', queued: 'info', canceled: 'neutral' }[status] ?? 'neutral';
  return (
    <span className={'pill pill-' + tone}>
      <span className="dot" />
      {status}
    </span>
  );
}

export function runDuration(run: Pick<WorkflowRunRow, 'startedAt' | 'finishedAt'>): string {
  if (!run.startedAt || !run.finishedAt) return '—';
  const ms = new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime();
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

const TRIGGER_LABELS: Record<string, string> = { event: 'Event', schedule: 'Schedule', manual: 'Manual', test: 'Test (draft)' };

export function WorkflowRuns({ workflowId, go }: { workflowId: string; go: Go }) {
  const { data: workflow } = useWorkflow(workflowId);
  const { data: runs, isLoading, isError } = useWorkflowRuns(workflowId);

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <IconButton name="arrowLeft" title="Back to editor" onClick={() => go('workflows', { workflowId })} />
        <h1 className="ph-title">{workflow ? `${workflow.name} — runs` : 'Runs'}</h1>
        <div style={{ marginLeft: 'auto' }}>
          <Button variant="outline" icon="edit" onClick={() => go('workflows', { workflowId })}>Open editor</Button>
        </div>
      </div>
      <div className="page-pad">
        {isLoading && <p className="muted">Loading…</p>}
        {isError && <p className="danger">Failed to load runs.</p>}
        {runs && runs.length === 0 && (
          <div className="card" style={{ borderStyle: 'dashed' }}>
            <EmptyState icon="history" title="No runs yet" body="Publish the workflow and trigger it from a ticket, or start a test run from the editor." />
          </div>
        )}
        {runs && runs.length > 0 && (
          <table className="tbl">
            <thead>
              <tr><th>Status</th><th>Trigger</th><th>Version</th><th>Started</th><th>Duration</th><th>Error</th></tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id} className="row-clickable" onClick={() => go('workflows', { workflowId, view: 'runs', runId: run.id })}>
                  <td><RunStatusPill status={run.status} /></td>
                  <td>
                    {TRIGGER_LABELS[run.triggerKind] ?? run.triggerKind}
                    {run.triggerContext?.event?.eventType ? <span className="muted"> · {run.triggerContext.event.eventType}</span> : null}
                  </td>
                  <td className="muted">{run.workflowVersion > 0 ? `v${run.workflowVersion}` : 'draft'}</td>
                  <td className="muted">{absTime(new Date(run.createdAt).getTime())}</td>
                  <td className="muted">{runDuration(run)}</td>
                  <td>{run.error ? <span className="wf-runrow-error" title={run.error}>{run.error}</span> : <span className="muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
