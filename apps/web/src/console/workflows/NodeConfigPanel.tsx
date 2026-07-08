// SPDX-License-Identifier: AGPL-3.0-only

import { lazy, Suspense, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { FilterLeaf, HttpAuthConfig, WorkflowEdge, WorkflowGraph, WorkflowNode } from '@tessio/shared';
import { triggerEvents } from '@tessio/shared';
import { CRON_PRESETS, nextRuns } from './cron';
import { Button } from '../ui';
import { Icon } from '../icons';
import { STATUS_MAP, PRIORITY_MAP } from '../data';
import { useUsers, useTeams } from '../tickets/queries';
import { useSecrets } from '../settings/queries';
import { NODE_META, filterToRows, rowsToFilter, type ConditionRow } from './graph-utils';
import { buildVariableCatalog, type VariableEntry } from './variables';
import { useTicketFields } from './queries';
import { TemplateInput, TemplateTextarea } from './TemplateField';

const ScriptEditor = lazy(() => import('./ScriptEditor').then((m) => ({ default: m.ScriptEditor })));

export interface PanelProps {
  graph: WorkflowGraph;
  selected: { kind: 'node' | 'edge'; id: string } | null;
  onChangeNode: (id: string, patch: Partial<WorkflowNode>) => void;
  onChangeEdge: (id: string, patch: Partial<WorkflowEdge>) => void;
  onDeleteNode: (id: string) => void;
  onDeleteEdge: (id: string) => void;
}

const EVENT_LABELS: Record<(typeof triggerEvents)[number], string> = {
  created: 'Ticket created',
  status: 'Status changed',
  priority: 'Priority changed',
  assigned: 'Assignee changed',
  team: 'Team changed',
  field_changed: 'A field changed',
};

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

/**
 * Edits a flat AND-list of condition rows. Rows live in local state (mount per
 * selection via `key`) because incomplete rows (empty field) are dropped by
 * rowsToFilter and would otherwise vanish from the form while being typed.
 */
function ConditionRows({
  rows: initialRows,
  onChange,
  fieldPlaceholder,
  variables,
}: {
  rows: ConditionRow[];
  onChange: (rows: ConditionRow[]) => void;
  fieldPlaceholder: string;
  variables?: VariableEntry[];
}) {
  const [rows, setRows] = useState<ConditionRow[]>(initialRows);
  const update = (next: ConditionRow[]) => {
    setRows(next);
    onChange(next);
  };
  const set = (i: number, patch: Partial<ConditionRow>) => update(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className="wf-rows">
      {rows.map((row, i) => (
        <div className="wf-row" key={i}>
          <input type="text" value={row.field} placeholder={fieldPlaceholder} onChange={(e) => set(i, { field: e.target.value })} />
          <select value={row.op} onChange={(e) => set(i, { op: e.target.value as FilterLeaf['op'] })}>
            {OPS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {row.op !== 'isNull' && (
            variables ? (
              <TemplateInput
                value={row.value}
                onChange={(v) => set(i, { value: v })}
                variables={variables}
                placeholder="value"
              />
            ) : (
              <input type="text" value={row.value} placeholder="value" onChange={(e) => set(i, { value: e.target.value })} />
            )
          )}
          <button className="wf-addrow wf-row-x" title="Remove condition" onClick={() => update(rows.filter((_, j) => j !== i))}>
            <Icon name="x" size={13} />
          </button>
        </div>
      ))}
      <button className="wf-addrow" onClick={() => update([...rows, { field: '', op: 'eq', value: '' }])}>+ Add condition</button>
    </div>
  );
}

/**
 * Edits a list of key/value pairs. Like ConditionRows, rows live in local state
 * (mount per selection via `key`): the parent drops empty-key entries when storing,
 * so a freshly-added blank row would otherwise be filtered out before you can type
 * into it — making "+ Add" appear to do nothing.
 */
function KeyValueRows({
  entries: initialEntries,
  onChange,
  keyPlaceholder,
  valuePlaceholder,
  variables,
}: {
  entries: [string, string][];
  onChange: (entries: [string, string][]) => void;
  keyPlaceholder: string;
  valuePlaceholder: string;
  variables?: VariableEntry[];
}) {
  const [entries, setEntries] = useState<[string, string][]>(initialEntries);
  const update = (next: [string, string][]) => {
    setEntries(next);
    onChange(next);
  };
  const set = (i: number, key: string, value: string) => update(entries.map((e, j) => (j === i ? [key, value] : e)));
  return (
    <div className="wf-rows">
      {entries.map(([k, v], i) => (
        <div className="wf-row" key={i}>
          <input type="text" value={k} placeholder={keyPlaceholder} onChange={(e) => set(i, e.target.value, v)} />
          {variables ? (
            <TemplateInput
              value={v}
              onChange={(val) => set(i, k, val)}
              variables={variables}
              placeholder={valuePlaceholder}
            />
          ) : (
            <input type="text" value={v} placeholder={valuePlaceholder} onChange={(e) => set(i, k, e.target.value)} />
          )}
          <button className="wf-addrow wf-row-x" title="Remove" onClick={() => update(entries.filter((_, j) => j !== i))}>
            <Icon name="x" size={13} />
          </button>
        </div>
      ))}
      <button className="wf-addrow" onClick={() => update([...entries, ['', '']])}>+ Add</button>
    </div>
  );
}


export function NodeConfigPanel({ graph, selected, onChangeNode, onChangeEdge, onDeleteNode, onDeleteEdge }: PanelProps) {
  const { data: users = [] } = useUsers();
  const { data: teams = [] } = useTeams();
  const { data: secrets = [] } = useSecrets();
  const { data: ticketFieldKeys = [] } = useTicketFields();
  const variables = useMemo(
    () => buildVariableCatalog(graph, selected?.kind === 'node' ? selected.id : undefined, ticketFieldKeys),
    [graph, selected, ticketFieldKeys],
  );

  if (!selected) {
    return (
      <aside className="wf-panel">
        <h3><Icon name="workflow" size={15} /> Workflow builder</h3>
        <p className="wf-panel-hint">
          Select a node to configure it, or drag from a node's handle to connect steps.
          Add parallel paths by connecting one node to several, and converge them with a join.
        </p>
        <p className="wf-panel-hint">
          Text inputs accept templates like <code>{'{{ ticket.priority }}'}</code> or <code>{'{{ nodes.script_1.output.value }}'}</code>.
        </p>
      </aside>
    );
  }

  if (selected.kind === 'edge') {
    const edge = graph.edges.find((e) => e.id === selected.id);
    if (!edge) return null;
    const fromBranch = graph.nodes.find((n) => n.id === edge.from)?.type === 'branch';
    return (
      <aside className="wf-panel">
        <h3><Icon name="arrowRight" size={15} /> Edge</h3>
        <div className="wf-field">
          <label>Label</label>
          <input type="text" value={edge.label ?? ''} onChange={(e) => onChangeEdge(edge.id, { label: e.target.value || undefined })} />
        </div>
        {fromBranch && (
          <>
            <label className="wf-check">
              <input
                type="checkbox"
                checked={edge.else ?? false}
                onChange={(e) => onChangeEdge(edge.id, { else: e.target.checked || undefined, condition: e.target.checked ? undefined : edge.condition })}
              />
              Else path (taken when nothing else matches)
            </label>
            {!edge.else && (
              <div className="wf-field">
                <label>Take this path when…</label>
                <ConditionRows
                  key={edge.id}
                  rows={filterToRows(edge.condition)}
                  onChange={(rows) => onChangeEdge(edge.id, { condition: rowsToFilter(rows) })}
                  fieldPlaceholder="ticket.priority"
                  variables={variables}
                />
              </div>
            )}
          </>
        )}
        <div className="wf-danger-zone">
          <Button variant="outline" icon="trash" onClick={() => onDeleteEdge(edge.id)}>Delete edge</Button>
        </div>
      </aside>
    );
  }

  const node = graph.nodes.find((n) => n.id === selected.id);
  if (!node) return null;
  const meta = NODE_META[node.type];
  const setConfig = (patch: Record<string, unknown>) =>
    onChangeNode(node.id, { config: { ...node.config, ...patch } } as Partial<WorkflowNode>);

  return (
    <aside className="wf-panel">
      <h3><Icon name={meta.icon} size={15} /> {meta.label}</h3>
      <p className="wf-panel-hint">{meta.blurb}.</p>
      <div className="wf-field">
        <label>Step name</label>
        <input type="text" value={node.name ?? ''} placeholder={meta.label} onChange={(e) => onChangeNode(node.id, { name: e.target.value || undefined })} />
      </div>

      {node.type === 'trigger' && (() => {
        const scheduleMode = !!node.config.schedule;
        const cronVal = node.config.schedule?.cron ?? '0 9 * * *';
        const tzVal = node.config.schedule?.timezone ?? 'UTC';
        const previews = scheduleMode ? nextRuns(cronVal, tzVal, 3) : [];
        const TIMEZONES = [
          'UTC',
          'America/New_York',
          'America/Chicago',
          'America/Denver',
          'America/Los_Angeles',
          'Europe/London',
          'Europe/Paris',
          'Asia/Tokyo',
          'Australia/Sydney',
        ];
        return (
          <>
            <div className="wf-field">
              <label>Trigger mode</label>
              <div className="wf-rows">
                <label className="wf-check">
                  <input
                    type="radio"
                    name={`trigger-mode-${node.id}`}
                    checked={!scheduleMode}
                    onChange={() => {
                      onChangeNode(node.id, { config: { ...node.config, schedule: undefined } } as Partial<WorkflowNode>);
                    }}
                  />
                  On event
                </label>
                <label className="wf-check">
                  <input
                    type="radio"
                    name={`trigger-mode-${node.id}`}
                    checked={scheduleMode}
                    onChange={() =>
                      onChangeNode(node.id, {
                        config: { ...node.config, events: [], schedule: { cron: '0 9 * * *', timezone: 'UTC' } },
                      } as Partial<WorkflowNode>)
                    }
                  />
                  On schedule
                </label>
              </div>
            </div>

            {!scheduleMode && (
              <>
                <div className="wf-field">
                  <label>Run when…</label>
                  <div className="wf-rows">
                    {triggerEvents.map((ev) => (
                      <label className="wf-check" key={ev}>
                        <input
                          type="checkbox"
                          checked={node.config.events.includes(ev)}
                          onChange={(e) =>
                            setConfig({ events: e.target.checked ? [...node.config.events, ev] : node.config.events.filter((x) => x !== ev) })
                          }
                        />
                        {EVENT_LABELS[ev]}
                      </label>
                    ))}
                  </div>
                </div>
                {node.config.events.includes('field_changed') && (
                  <div className="wf-field">
                    <label>Only these fields (comma-separated, empty = any)</label>
                    <input
                      type="text"
                      value={(node.config.fields ?? []).join(', ')}
                      placeholder="category, urgency"
                      onChange={(e) =>
                        setConfig({ fields: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })
                      }
                    />
                  </div>
                )}
                <div className="wf-field">
                  <label>And only if… (all must match)</label>
                  <ConditionRows
                    key={node.id}
                    rows={filterToRows(node.config.condition)}
                    onChange={(rows) => setConfig({ condition: rowsToFilter(rows) })}
                    fieldPlaceholder="status or data.category"
                    variables={variables}
                  />
                </div>
              </>
            )}

            {scheduleMode && (
              <>
                <div className="wf-field">
                  <label>Cron expression</label>
                  <input
                    type="text"
                    value={cronVal}
                    placeholder="0 9 * * *"
                    onChange={(e) =>
                      setConfig({ schedule: { ...node.config.schedule, cron: e.target.value } })
                    }
                  />
                  <div className="wf-rows" style={{ marginTop: 6 }}>
                    {CRON_PRESETS.map((p) => (
                      <button
                        key={p.cron}
                        className="wf-addrow"
                        onClick={() => setConfig({ schedule: { ...node.config.schedule, cron: p.cron } })}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="wf-field">
                  <label>Timezone</label>
                  <select
                    value={tzVal}
                    onChange={(e) =>
                      setConfig({ schedule: { ...node.config.schedule, timezone: e.target.value } })
                    }
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz} value={tz}>{tz}</option>
                    ))}
                  </select>
                </div>
                <div className="wf-field">
                  <label>Next runs</label>
                  {previews.length > 0 ? (
                    <div className="wf-rows">
                      {previews.map((d, i) => (
                        <span key={i} className="wf-panel-hint" style={{ margin: 0 }}>
                          {d.toLocaleString()}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="wf-panel-hint">Enter a valid cron expression</p>
                  )}
                </div>
              </>
            )}
          </>
        );
      })()}

      {node.type === 'join' && (
        <div className="wf-field">
          <label>Continue when…</label>
          <label className="wf-check">
            <input type="radio" name="join-mode" checked={node.config.mode === 'all'} onChange={() => setConfig({ mode: 'all' })} />
            All incoming paths arrive
          </label>
          <label className="wf-check">
            <input type="radio" name="join-mode" checked={node.config.mode === 'any'} onChange={() => setConfig({ mode: 'any' })} />
            The first path arrives
          </label>
        </div>
      )}

      {node.type === 'branch' && (
        <div className="wf-field">
          <label>Paths (first match wins)</label>
          <div className="wf-rows">
            {graph.edges.filter((e) => e.from === node.id).map((edge) => (
              <div className="wf-edge-item" key={edge.id}>
                <div className="wf-edge-head">
                  <Icon name="arrowRight" size={13} />
                  → {graph.nodes.find((n) => n.id === edge.to)?.name ?? graph.nodes.find((n) => n.id === edge.to)?.id ?? edge.to}
                  {edge.else && <span className="muted">(else)</span>}
                </div>
                {!edge.else && (
                  <ConditionRows
                    key={edge.id}
                    rows={filterToRows(edge.condition)}
                    onChange={(rows) => onChangeEdge(edge.id, { condition: rowsToFilter(rows) })}
                    fieldPlaceholder="ticket.priority"
                    variables={variables}
                  />
                )}
                <label className="wf-check">
                  <input
                    type="checkbox"
                    checked={edge.else ?? false}
                    onChange={(e) => onChangeEdge(edge.id, { else: e.target.checked || undefined, condition: e.target.checked ? undefined : edge.condition })}
                  />
                  Else path
                </label>
              </div>
            ))}
            {graph.edges.filter((e) => e.from === node.id).length === 0 && (
              <p className="wf-panel-hint">Connect this branch to other nodes, then define each path's condition here.</p>
            )}
          </div>
        </div>
      )}

      {node.type === 'update_ticket' && (
        <>
          <div className="wf-field">
            <label>Status</label>
            <select value={node.config.set.status ?? ''} onChange={(e) => setConfig({ set: { ...node.config.set, status: e.target.value || undefined } })}>
              <option value="">(leave unchanged)</option>
              {Object.entries(STATUS_MAP).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
          <div className="wf-field">
            <label>Priority</label>
            <select value={node.config.set.priority ?? ''} onChange={(e) => setConfig({ set: { ...node.config.set, priority: e.target.value || undefined } })}>
              <option value="">(leave unchanged)</option>
              {Object.entries(PRIORITY_MAP).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
          <div className="wf-field">
            <label>Assignee</label>
            <select value={node.config.set.assigneeId ?? ''} onChange={(e) => setConfig({ set: { ...node.config.set, assigneeId: e.target.value || undefined } })}>
              <option value="">(leave unchanged)</option>
              {users.filter((u) => u.role !== 'requester').map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          <div className="wf-field">
            <label>Team</label>
            <select value={node.config.set.teamId ?? ''} onChange={(e) => setConfig({ set: { ...node.config.set, teamId: e.target.value || undefined } })}>
              <option value="">(leave unchanged)</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div className="wf-field">
            <label>Custom fields</label>
            <KeyValueRows
              key={`${node.id}:data`}
              entries={Object.entries(node.config.set.data ?? {})}
              onChange={(entries) =>
                setConfig({ set: { ...node.config.set, data: entries.length ? Object.fromEntries(entries.filter(([k]) => k.trim())) : undefined } })
              }
              keyPlaceholder="field key"
              valuePlaceholder="value or {{ template }}"
              variables={variables}
            />
          </div>
        </>
      )}

      {node.type === 'add_comment' && (
        <>
          <div className="wf-field">
            <label>Comment</label>
            <TemplateTextarea
              value={node.config.body}
              placeholder={'Thanks! We are on it.\nSupports {{ ticket.priority }} templates.'}
              onChange={(v) => setConfig({ body: v })}
              variables={variables}
            />
          </div>
          <label className="wf-check">
            <input type="checkbox" checked={node.config.internal ?? false} onChange={(e) => setConfig({ internal: e.target.checked || undefined })} />
            Internal note (hidden from the requester)
          </label>
        </>
      )}

      {node.type === 'http_request' && (
        <>
          <div className="wf-field">
            <label>Method & URL</label>
            <div className="wf-row">
              <select
                style={{ width: 92, flex: 'none' }}
                value={node.config.method}
                onChange={(e) => setConfig({ method: e.target.value })}
              >
                {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
              <TemplateInput
                value={node.config.url}
                placeholder="https://api.example.com/notify"
                onChange={(v) => setConfig({ url: v })}
                variables={variables}
              />
            </div>
          </div>
          <div className="wf-field">
            <label>Auth</label>
            <div className="wf-row">
              <select
                style={{ width: 120, flex: 'none' }}
                value={node.config.auth?.type ?? 'none'}
                onChange={(e) => {
                  const type = e.target.value;
                  const next: HttpAuthConfig =
                    type === 'none' ? { type: 'none' }
                    : type === 'bearer' ? { type: 'bearer', secret: '' }
                    : type === 'basic' ? { type: 'basic', username: '', secret: '' }
                    : { type: 'apiKey', header: 'X-Api-Key', secret: '' };
                  setConfig({ auth: type === 'none' ? undefined : next });
                }}
              >
                <option value="none">None</option>
                <option value="bearer">Bearer token</option>
                <option value="basic">Basic</option>
                <option value="apiKey">API key header</option>
              </select>
            </div>
            {node.config.auth && node.config.auth.type !== 'none' && (
              <div className="wf-rows" style={{ marginTop: 6 }}>
                {node.config.auth.type === 'basic' && (
                  <input
                    type="text"
                    placeholder="username"
                    value={node.config.auth.username}
                    onChange={(e) => {
                      const auth = node.config.auth as Extract<HttpAuthConfig, { type: 'basic' }>;
                      setConfig({ auth: { ...auth, username: e.target.value } });
                    }}
                  />
                )}
                {node.config.auth.type === 'apiKey' && (
                  <input
                    type="text"
                    placeholder="header name (e.g. X-Api-Key)"
                    value={node.config.auth.header}
                    onChange={(e) => {
                      const auth = node.config.auth as Extract<HttpAuthConfig, { type: 'apiKey' }>;
                      setConfig({ auth: { ...auth, header: e.target.value } });
                    }}
                  />
                )}
                <select
                  value={node.config.auth.secret}
                  onChange={(e) => {
                    const auth = node.config.auth as Extract<HttpAuthConfig, { type: 'bearer' | 'basic' | 'apiKey' }>;
                    setConfig({ auth: { ...auth, secret: e.target.value } });
                  }}
                >
                  <option value="">Choose a secret…</option>
                  {secrets.map((s) => (
                    <option key={s.name} value={s.name}>{s.name}</option>
                  ))}
                </select>
                {secrets.length === 0 && (
                  <p className="wf-panel-hint">No secrets yet — add one under Settings → Secrets.</p>
                )}
              </div>
            )}
          </div>
          <div className="wf-field">
            <label>Headers</label>
            <KeyValueRows
              key={`${node.id}:headers`}
              entries={Object.entries(node.config.headers ?? {})}
              onChange={(entries) => setConfig({ headers: entries.length ? Object.fromEntries(entries.filter(([k]) => k.trim())) : undefined })}
              keyPlaceholder="Authorization"
              valuePlaceholder="Bearer …"
              variables={variables}
            />
          </div>
          {node.config.method !== 'GET' && (
            <div className="wf-field">
              <label>Body</label>
              <TemplateTextarea
                className="wf-code"
                style={{ minHeight: 90 }}
                value={node.config.body ?? ''}
                placeholder={'{"ticket": "{{ ticket.id }}", "priority": "{{ ticket.priority }}"}'}
                onChange={(v) => setConfig({ body: v || undefined })}
                variables={variables}
              />
            </div>
          )}
          <div className="wf-field">
            <label>Timeout (ms, max 30000)</label>
            <input
              type="number"
              value={node.config.timeoutMs ?? 10000}
              min={100}
              max={30000}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setConfig({ timeoutMs: Number(e.target.value) || undefined })}
            />
          </div>
          <p className="wf-panel-hint">
            The response is available downstream as <code>{'{{ nodes.' + node.id + '.output.body }}'}</code> (plus <code>.status</code> and <code>.ok</code>).
          </p>
        </>
      )}

      {node.type === 'slack_message' && (
        <>
          <div className="wf-field">
            <label>Message</label>
            <TemplateTextarea
              value={node.config.text}
              placeholder={'Ticket #{{ ticket.number }} needs attention.\nSupports {{ ticket.priority }} templates.'}
              onChange={(v) => setConfig({ text: v })}
              variables={variables}
            />
          </div>
          <p className="wf-panel-hint">
            Posts to the Slack channel connected under Settings → Slack. The step fails if the integration is not configured.
          </p>
        </>
      )}

      {node.type === 'script' && (
        <>
          <div className="wf-field">
            <label>JavaScript</label>
            <Suspense fallback={<div className="wf-code" style={{ minHeight: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading editor…</div>}>
              <ScriptEditor
                value={node.config.code}
                onChange={(code) => setConfig({ code })}
                ticketFieldKeys={ticketFieldKeys}
              />
            </Suspense>
          </div>
          <p className="wf-panel-hint">
            The body runs as a function: use <code>return</code> to produce this node's output.
            Read data from <code>ctx.ticket</code>, <code>ctx.trigger</code>, <code>ctx.nodes.&lt;id&gt;.output</code>.
            The returned value is available downstream as <code>{'{{ nodes.' + node.id + '.output }}'}</code>.
          </p>
          <div className="wf-field">
            <label>Timeout (ms, max 5000)</label>
            <input
              type="number"
              value={node.config.timeoutMs ?? 1000}
              min={50}
              max={5000}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setConfig({ timeoutMs: Number(e.target.value) || undefined })}
            />
          </div>
        </>
      )}

      {node.type !== 'trigger' && (
        <div className="wf-danger-zone">
          <Button variant="outline" icon="trash" onClick={() => onDeleteNode(node.id)}>Delete node</Button>
        </div>
      )}
    </aside>
  );
}
