// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { FilterLeaf, ReportDefinition, ReportDimension } from '@tessio/shared';
import { REPORT_MEASURES, REPORT_DIMENSIONS, findDimension, isDataField } from '@tessio/shared';
import { Button } from '../ui';
import { Icon } from '../icons';
import type { Route } from '../shell';
import { STATUS_MAP, PRIORITY_MAP } from '../data';
import { useUsers, useTeams, useTicketSchemas } from '../tickets/queries';
import { useTicketFields } from '../workflows/queries';
import { filterToRows, rowsToFilter, type ConditionRow } from '../workflows/graph-utils';
import { useReport, useUpdateReport, useDeleteReport, useRunReport } from './queries';
import { BarChart, LineChart, PieChart, NumberStat, ResultTable } from './charts';
import type { ReportRow } from '../../api/reports';

type Go = (screen: string, extra?: Partial<Route>) => void;

// ---------------------------------------------------------------------------
// Condition rows editor (local equivalent of ConditionRows in NodeConfigPanel)
// ---------------------------------------------------------------------------

const OPS: { value: FilterLeaf['op']; label: string }[] = [
  { value: 'eq', label: '=' },
  { value: 'ne', label: '≠' },
  { value: 'gt', label: '>' },
  { value: 'gte', label: '≥' },
  { value: 'lt', label: '<' },
  { value: 'lte', label: '≤' },
  { value: 'contains', label: 'contains' },
  { value: 'startsWith', label: 'starts with' },
  { value: 'in', label: 'in (comma list)' },
  { value: 'isNull', label: 'is empty' },
];

function FilterRows({
  rows: initialRows,
  onChange,
}: {
  rows: ConditionRow[];
  onChange: (rows: ConditionRow[]) => void;
}) {
  const [rows, setRows] = useState<ConditionRow[]>(initialRows);
  const update = (next: ConditionRow[]) => {
    setRows(next);
    onChange(next);
  };
  const set = (i: number, patch: Partial<ConditionRow>) =>
    update(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className="wf-rows">
      {rows.map((row, i) => (
        <div className="wf-row" key={i}>
          <input
            type="text"
            value={row.field}
            placeholder="field (e.g. status)"
            onChange={(e) => set(i, { field: e.target.value })}
          />
          <select value={row.op} onChange={(e) => set(i, { op: e.target.value as FilterLeaf['op'] })}>
            {OPS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {row.op !== 'isNull' && (
            <input
              type="text"
              value={row.value}
              placeholder="value"
              onChange={(e) => set(i, { value: e.target.value })}
            />
          )}
          <button
            className="wf-addrow wf-row-x"
            title="Remove condition"
            onClick={() => update(rows.filter((_, j) => j !== i))}
          >
            <Icon name="x" size={13} />
          </button>
        </div>
      ))}
      <button
        className="wf-addrow"
        onClick={() => update([...rows, { field: '', op: 'eq', value: '' }])}
      >
        + Add condition
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Default definition
// ---------------------------------------------------------------------------

const DEFAULT_DEF: ReportDefinition = {
  source: 'tickets',
  measure: { id: 'count' },
  groupBy: { field: 'status' },
  visualization: 'bar',
};

// ---------------------------------------------------------------------------
// renderKey helper factory
// ---------------------------------------------------------------------------

function useRenderKey(definition: ReportDefinition): (key: string | null) => ReactNode {
  const { data: users } = useUsers();
  const { data: teams } = useTeams();
  const { data: schemas } = useTicketSchemas();

  return useCallback(
    (key: string | null): ReactNode => {
      if (key === null || key === undefined) return '(total)';
      const field = definition.groupBy?.field;
      if (!field) return key;

      const dim: ReportDimension | undefined = findDimension(field);
      const kind = dim?.kind ?? (isDataField(field) ? 'string' : 'string');

      if (kind === 'status') return STATUS_MAP[key]?.label ?? key;
      if (kind === 'priority') return PRIORITY_MAP[key]?.label ?? key;
      if (kind === 'user') {
        const user = users?.find((u) => u.id === key);
        return user?.name ?? key;
      }
      if (kind === 'team') {
        const team = teams?.find((t) => t.id === key);
        return team?.name ?? key;
      }
      if (kind === 'schema') {
        const schema = schemas?.find((s) => s.id === key);
        return schema?.name ?? key;
      }
      // date or string — use as-is
      return key;
    },
    [definition.groupBy?.field, users, teams, schemas],
  );
}

// ---------------------------------------------------------------------------
// Preview panel
// ---------------------------------------------------------------------------

interface PreviewProps {
  definition: ReportDefinition;
  rows: ReportRow[] | null;
  isLoading: boolean;
  error: string | null;
  renderKey: (key: string | null) => ReactNode;
  measureLabel: string;
}

function Preview({ definition, rows, isLoading, error, renderKey, measureLabel }: PreviewProps) {
  const viz = definition.visualization;

  let chart: ReactNode;
  if (isLoading) {
    chart = <div className="rpt-preview-loading"><Icon name="refresh" size={18} style={{ opacity: 0.4 }} /><span>Running…</span></div>;
  } else if (error) {
    chart = <div className="rpt-preview-error"><Icon name="alert" size={15} /><span>{error}</span></div>;
  } else if (!rows) {
    chart = <div className="rpt-preview-empty">Configure the report to see a preview.</div>;
  } else if (viz === 'bar') {
    chart = <BarChart rows={rows} renderKey={renderKey} label={measureLabel} />;
  } else if (viz === 'line') {
    chart = <LineChart rows={rows} renderKey={renderKey} label={measureLabel} />;
  } else if (viz === 'pie') {
    chart = <PieChart rows={rows} renderKey={renderKey} label={measureLabel} />;
  } else if (viz === 'number') {
    chart = <NumberStat rows={rows} renderKey={renderKey} label={measureLabel} />;
  } else {
    chart = <ResultTable rows={rows} renderKey={renderKey} label={measureLabel} />;
  }

  return (
    <div className="rpt-preview">
      <div className="rpt-preview-title">Preview</div>
      <div className="rpt-preview-content">{chart}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ReportBuilder
// ---------------------------------------------------------------------------

export function ReportBuilder({ reportId, go }: { reportId: string; go: Go }) {
  const { data: saved, isLoading: loadingSaved, isError: loadError } = useReport(reportId);

  const updateReport = useUpdateReport(reportId);
  const deleteReport = useDeleteReport();
  const runReport = useRunReport();

  // Ticket fields for custom data.* dimensions/measures
  const { data: ticketFields } = useTicketFields();

  // Definition state
  const [definition, setDefinition] = useState<ReportDefinition>(DEFAULT_DEF);
  const [name, setName] = useState('New report');
  const [description, setDescription] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Filter rows (local for intermediate state while user types)
  const [filterRows, setFilterRows] = useState<ConditionRow[]>([]);

  // Preview state
  const [previewRows, setPreviewRows] = useState<ReportRow[] | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sequence guard: prevents stale debounced preview responses from overwriting newer ones
  const runSeqRef = useRef(0);

  // Seed local state exactly once per report id — never re-clobber on refetch/save
  const seededIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (saved && seededIdRef.current !== saved.id) {
      seededIdRef.current = saved.id;
      setDefinition(saved.definition);
      setName(saved.name);
      setDescription(saved.description ?? '');
      setFilterRows(filterToRows(saved.definition.filter));
      setPreviewRows(null);
    }
  }, [saved]);

  // Capture stable mutate reference to satisfy exhaustive-deps without disabling the rule
  const runMutate = runReport.mutate;

  // Debounce preview on definition change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const seq = ++runSeqRef.current;
      setPreviewError(null);
      runMutate(definition, {
        onSuccess: (result) => {
          if (seq !== runSeqRef.current) return; // stale response — discard
          setPreviewRows(result.rows);
        },
        onError: (err) => {
          if (seq !== runSeqRef.current) return; // stale response — discard
          const e = err as { detail?: string; message?: string };
          setPreviewError(e.detail ?? e.message ?? 'Failed to run report.');
          setPreviewRows(null);
        },
      });
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [definition, runMutate]);

  const renderKey = useRenderKey(definition);

  function patch(partial: Partial<ReportDefinition>) {
    setDefinition((d) => ({ ...d, ...partial }));
  }

  function onMeasureChange(id: string) {
    if (isDataField(id)) {
      patch({ measure: { id, fn: 'avg' } });
    } else {
      patch({ measure: { id } });
    }
  }

  function onGroupByChange(field: string) {
    if (field === '') {
      patch({ groupBy: undefined });
    } else {
      const dim = findDimension(field);
      const isDate = dim?.kind === 'date';
      patch({
        groupBy: {
          field,
          ...(isDate ? { dateBucket: 'day' } : {}),
          limit: definition.groupBy?.limit,
        },
      });
    }
  }

  function onFilterRowsChange(rows: ConditionRow[]) {
    setFilterRows(rows);
    patch({ filter: rowsToFilter(rows) });
  }

  async function onSave() {
    setSaveError(null);
    setSaveSuccess(false);
    try {
      await updateReport.mutateAsync({
        name,
        description: description || undefined,
        definition,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      const e = err as { detail?: string; message?: string };
      setSaveError(e.detail ?? e.message ?? 'Could not save the report.');
    }
  }

  async function onDelete() {
    if (!confirm('Delete this report?')) return;
    try {
      await deleteReport.mutateAsync(reportId);
      go('reports');
    } catch (err) {
      const e = err as { detail?: string; message?: string };
      setSaveError(e.detail ?? e.message ?? 'Could not delete the report.');
    }
  }

  if (loadingSaved) {
    return <div className="page"><div className="page-pad muted">Loading…</div></div>;
  }

  if (loadError) {
    return (
      <div className="page">
        <div className="page-pad">
          <p className="muted">Failed to load this report.</p>
          <Button variant="outline" icon="arrowLeft" onClick={() => go('reports')}>Back to reports</Button>
        </div>
      </div>
    );
  }

  const measureLabel = REPORT_MEASURES.find((m) => m.id === definition.measure.id)?.label ?? definition.measure.id;
  const customDataFields = ticketFields ?? [];
  const isDateDim =
    definition.groupBy?.field === 'createdAt' || definition.groupBy?.field === 'resolvedAt';

  const isPending = updateReport.isPending;

  return (
    <div className="rpt-editor">
      {/* Toolbar */}
      <div className="wf-toolbar">
        <button
          className="btn-icon"
          title="Back to reports"
          onClick={() => go('reports')}
        >
          <Icon name="arrowLeft" size={18} />
        </button>
        <input
          className="wf-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Report name"
        />
        <div style={{ flex: 1 }} />
        {saveError && <span className="danger" style={{ fontSize: 13 }}>{saveError}</span>}
        {saveSuccess && <span className="success" style={{ fontSize: 13 }}>Saved</span>}
        <Button variant="primary" onClick={onSave} disabled={isPending}>
          {isPending ? 'Saving…' : 'Save'}
        </Button>
      </div>

      {/* Body: config panel + preview */}
      <div className="rpt-body">
        {/* Config panel */}
        <div className="rpt-panel">
          {/* Name + description */}
          <div className="wf-field">
            <label>Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
            />
          </div>

          {/* Measure */}
          <div className="wf-field">
            <label>Measure</label>
            <select
              value={definition.measure.id}
              onChange={(e) => onMeasureChange(e.target.value)}
            >
              <optgroup label="Tickets">
                {REPORT_MEASURES.filter((m) => m.group === 'tickets').map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </optgroup>
              <optgroup label="AI">
                {REPORT_MEASURES.filter((m) => m.group === 'ai').map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </optgroup>
              {customDataFields.length > 0 && (
                <optgroup label="Custom fields">
                  {customDataFields.map((key) => (
                    <option key={`data.${key}`} value={`data.${key}`}>data.{key}</option>
                  ))}
                </optgroup>
              )}
            </select>
            {/* Aggregation fn for custom data fields */}
            {isDataField(definition.measure.id) && (
              <select
                value={definition.measure.fn ?? 'avg'}
                onChange={(e) =>
                  patch({
                    measure: {
                      ...definition.measure,
                      fn: e.target.value as 'avg' | 'sum' | 'min' | 'max',
                    },
                  })
                }
              >
                <option value="avg">Average</option>
                <option value="sum">Sum</option>
                <option value="min">Min</option>
                <option value="max">Max</option>
              </select>
            )}
          </div>

          {/* Group by */}
          <div className="wf-field">
            <label>Group by</label>
            <select
              value={definition.groupBy?.field ?? ''}
              onChange={(e) => onGroupByChange(e.target.value)}
            >
              <option value="">(none — single number)</option>
              <optgroup label="Standard">
                {REPORT_DIMENSIONS.map((d) => (
                  <option key={d.id} value={d.id}>{d.label}</option>
                ))}
              </optgroup>
              {customDataFields.length > 0 && (
                <optgroup label="Custom fields">
                  {customDataFields.map((key) => (
                    <option key={`data.${key}`} value={`data.${key}`}>data.{key}</option>
                  ))}
                </optgroup>
              )}
            </select>
            {/* Date bucket when a date dimension is selected */}
            {isDateDim && definition.groupBy && (
              <select
                value={definition.groupBy.dateBucket ?? 'day'}
                onChange={(e) =>
                  patch({
                    groupBy: {
                      ...definition.groupBy!,
                      dateBucket: e.target.value as 'day' | 'week' | 'month',
                    },
                  })
                }
              >
                <option value="day">By day</option>
                <option value="week">By week</option>
                <option value="month">By month</option>
              </select>
            )}
            {/* Top-N limit */}
            {definition.groupBy && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>Top N</span>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={definition.groupBy.limit ?? ''}
                  placeholder="20"
                  onChange={(e) =>
                    patch({
                      groupBy: {
                        ...definition.groupBy!,
                        limit: e.target.value ? Number(e.target.value) : undefined,
                      },
                    })
                  }
                />
              </div>
            )}
          </div>

          {/* Filter */}
          <div className="wf-field">
            <label>Filter</label>
            <FilterRows
              key={reportId}
              rows={filterRows}
              onChange={onFilterRowsChange}
            />
          </div>

          {/* Date range */}
          <div className="wf-field">
            <label>Date range</label>
            <select
              value={definition.dateRange?.field ?? 'createdAt'}
              onChange={(e) =>
                patch({
                  dateRange: {
                    ...definition.dateRange,
                    field: e.target.value as 'createdAt' | 'resolvedAt',
                  },
                })
              }
            >
              <option value="createdAt">Created date</option>
              <option value="resolvedAt">Resolved date</option>
            </select>
            <select
              value={definition.dateRange?.preset ?? 'all'}
              onChange={(e) => {
                if (e.target.value === 'all') {
                  patch({ dateRange: undefined });
                } else {
                  patch({
                    dateRange: {
                      field: definition.dateRange?.field ?? 'createdAt',
                      preset: e.target.value as NonNullable<ReportDefinition['dateRange']>['preset'],
                    },
                  });
                }
              }}
            >
              <option value="all">All time</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="12mo">Last 12 months</option>
              <option value="mtd">Month to date</option>
              <option value="ytd">Year to date</option>
            </select>
          </div>

          {/* Visualization */}
          <div className="wf-field">
            <label>Visualization</label>
            <div className="rpt-viz-toggle">
              {(['bar', 'line', 'pie', 'table', 'number'] as const).map((v) => (
                <button
                  key={v}
                  className={'rpt-viz-btn' + (definition.visualization === v ? ' active' : '')}
                  onClick={() => patch({ visualization: v })}
                  title={v}
                >
                  <Icon
                    name={v === 'bar' ? 'chart' : v === 'line' ? 'trendUp' : v === 'pie' ? 'activity' : v === 'table' ? 'columns' : 'trendUp'}
                    size={15}
                  />
                  <span>{v}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Delete */}
          <div className="wf-danger-zone" style={{ marginTop: 'auto' }}>
            <Button
              variant="outline"
              icon="x"
              onClick={onDelete}
              disabled={deleteReport.isPending}
              style={{ color: 'var(--danger)', borderColor: 'color-mix(in oklab, var(--danger) 35%, transparent)' }}
            >
              {deleteReport.isPending ? 'Deleting…' : 'Delete report'}
            </Button>
          </div>
        </div>

        {/* Preview */}
        <Preview
          definition={definition}
          rows={previewRows}
          isLoading={runReport.isPending}
          error={previewError}
          renderKey={renderKey}
          measureLabel={measureLabel}
        />
      </div>
    </div>
  );
}
