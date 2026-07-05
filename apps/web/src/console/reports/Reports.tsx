// SPDX-License-Identifier: AGPL-3.0-only

import { useState } from 'react';
import { Button, EmptyState } from '../ui';
import { Icon } from '../icons';
import type { Route } from '../shell';
import type { ReportListItem } from '../../api/reports';
import { useReports, useCreateReport } from './queries';

type Go = (screen: string, extra?: Partial<Route>) => void;

const VIZ_ICONS: Record<string, string> = {
  bar: 'chart',
  line: 'trendUp',
  pie: 'activity',
  table: 'columns',
  number: 'trendUp',
};

function VizIcon({ viz }: { viz: string }) {
  const icon = VIZ_ICONS[viz] ?? 'chart';
  return <Icon name={icon} size={16} style={{ color: 'var(--primary)' }} />;
}

function ReportCard({ report, onClick }: { report: ReportListItem; onClick: () => void }) {
  return (
    <div className="rpt-card" onClick={onClick}>
      <div className="rpt-card-icon">
        <VizIcon viz={report.visualization} />
      </div>
      <div className="rpt-card-body">
        <div className="rpt-card-name">{report.name}</div>
        {report.description && <div className="rpt-card-desc">{report.description}</div>}
      </div>
      <div className="rpt-card-meta">
        {new Date(report.updatedAt).toLocaleDateString()}
      </div>
    </div>
  );
}

export function Reports({ go }: { go: Go }) {
  const { data: reports, isLoading, isError } = useReports();
  const createReport = useCreateReport();
  const [error, setError] = useState<string | null>(null);

  async function onNew() {
    setError(null);
    try {
      const report = await createReport.mutateAsync({
        name: 'New report',
        definition: {
          source: 'tickets',
          measure: { id: 'count' },
          groupBy: { field: 'status' },
          visualization: 'bar',
        },
      });
      go('reports', { reportId: report.id });
    } catch (err) {
      const e = err as { detail?: string; message?: string };
      setError(e.detail ?? e.message ?? 'Could not create the report.');
    }
  }

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="ph-title">Reports</h1>
        <Button variant="primary" icon="plus" onClick={onNew} disabled={createReport.isPending}>
          {createReport.isPending ? 'Creating…' : 'New report'}
        </Button>
      </div>
      <div className="page-pad">
        {error && <div className="danger inline-error" role="alert">{error}</div>}
        {isLoading && <p className="muted">Loading…</p>}
        {isError && <p className="danger">Failed to load reports.</p>}
        {reports && reports.length === 0 && (
          <div className="card" style={{ borderStyle: 'dashed' }}>
            <EmptyState
              icon="chart"
              title="No reports yet"
              body="Build custom reports: choose a measure, group by a dimension, filter, and visualize as bar, line, pie, table, or number."
              action={
                <Button variant="primary" icon="plus" onClick={onNew} disabled={createReport.isPending}>
                  Create first report
                </Button>
              }
            />
          </div>
        )}
        {reports && reports.length > 0 && (
          <div className="rpt-list">
            {reports.map((r) => (
              <ReportCard
                key={r.id}
                report={r}
                onClick={() => go('reports', { reportId: r.id })}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
