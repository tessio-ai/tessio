// SPDX-License-Identifier: AGPL-3.0-only

/* Tickets — list view. Ported from the design handoff. */
import { useEffect, useState } from 'react';
import { Icon } from './icons';
import { Button, IconButton, Popover, StatusPill, PriorityTag, AvatarName, EmptyState, SkeletonRows, relTime, absTime } from './ui';
import { TriageBanner } from './agent';
import { STATUS_MAP, PRIORITY_MAP, TYPE_MAP } from './data';
import { useTickets, useUsers, useTicketSchemas } from './tickets/queries';
import { toDisplayTicket, usersById, savedViews, type DisplayTicket } from './tickets/adapt';
import { ticketTypeKeyById } from './tickets/types-map';
import { updateTicket } from '../api/tickets';
import { useQueryClient } from '@tanstack/react-query';
import type { Route } from './shell';

type Go = (screen: string, extra?: Partial<Route> & { create?: boolean }) => void;

// Optional table columns the user can show/hide via the Columns menu (# / Title are always shown).
const COLUMN_TOGGLES = [
  { key: 'status', label: 'Status' },
  { key: 'priority', label: 'Priority' },
  { key: 'assignee', label: 'Assignee' },
  { key: 'updated', label: 'Updated' },
] as const;

function FilterDropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value?: string | null;
  options: { value: string; label: string; swatch?: string }[];
  onChange: (v: string | null) => void;
}) {
  return (
    <Popover
      align="left"
      width={180}
      trigger={
        <button className="filter-btn">
          {label}
          {value && <span style={{ color: 'var(--primary)', fontWeight: 700 }}>: {value}</span>}
          <Icon name="chevronDown" size={14} />
        </button>
      }
    >
      {(close) => (
        <div className="menu">
          <div className="menu-item" onClick={() => { onChange(null); close(); }}>
            Any {label.toLowerCase()}
            {!value && <span className="check"><Icon name="check" size={14} /></span>}
          </div>
          <div className="menu-div" />
          {options.map((o) => (
            <div key={o.value} className="menu-item" onClick={() => { onChange(o.value); close(); }}>
              {o.swatch && <span className="pdot" style={{ width: 8, height: 8, borderRadius: '50%', background: o.swatch }} />}
              {o.label}
              {value === o.value && <span className="check"><Icon name="check" size={14} /></span>}
            </div>
          ))}
        </div>
      )}
    </Popover>
  );
}

export function TicketsList({
  go,
  route,
  density,
  setDensity,
  selected,
  setSelected,
  me,
}: {
  go: Go;
  route: Route;
  density: string;
  setDensity: (d: string) => void;
  selected: Set<string>;
  setSelected: (f: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  loading: boolean;
  me: string | null;
}) {
  const [activeView, setActiveView] = useState(route.view || 'all');
  const [search, setSearch] = useState('');
  const [fStatus, setFStatus] = useState<string | null>(null);
  const [fPriority, setFPriority] = useState<string | null>(null);
  const [fAssignee, setFAssignee] = useState<string | null>(null);
  const [fType, setFType] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: string; dir: string }>({ key: 'updatedAt', dir: 'desc' });
  const [limit, setLimit] = useState(10);
  const [cols, setCols] = useState<Record<string, boolean>>({ status: true, priority: true, assignee: true, updated: true });

  useEffect(() => {
    if (route.view) setActiveView(route.view);
  }, [route.view]);

  const usersQ = useUsers();
  const schemasQ = useTicketSchemas();
  const ticketsQ = useTickets({ limit: 200, sort: { field: 'updatedAt', dir: 'desc', type: 'date' } });
  const qc = useQueryClient();
  const umap = usersById(usersQ.data ?? []);
  const typeById = ticketTypeKeyById(schemasQ.data ?? []);
  const allRows = (ticketsQ.data?.rows ?? []).map((r) => toDisplayTicket(r, typeById));
  const VIEWS = savedViews(me);
  const view = VIEWS.find((v) => v.id === activeView) || VIEWS[0];
  // Search + filter predicate, shared by the visible list AND the tab counts so the
  // badge never disagrees with "Showing X of Y" (e.g. "Unassigned 26" while only 2 match a search).
  const q = search.trim().toLowerCase();
  const matchesFilters = (t: DisplayTicket) =>
    (!q || (t.title + ' #' + t.number).toLowerCase().includes(q)) &&
    (!fStatus || t.status === fStatus) &&
    (!fPriority || t.priority === fPriority) &&
    (!fType || t.type === fType) &&
    (!fAssignee || (fAssignee === 'none' ? !t.assigneeId : t.assigneeId === fAssignee));
  let rows = allRows.filter((t) => view.filter(t) && matchesFilters(t));
  rows = [...rows].sort((a, b) => {
    let av: any = (a as any)[sort.key],
      bv: any = (b as any)[sort.key];
    if (sort.key === 'priority') {
      av = PRIORITY_MAP[a.priority]?.rank ?? 0;
      bv = PRIORITY_MAP[b.priority]?.rank ?? 0;
    }
    if (sort.key === 'number') {
      av = a.number;
      bv = b.number;
    }
    return (av > bv ? 1 : av < bv ? -1 : 0) * (sort.dir === 'asc' ? 1 : -1);
  });
  const total = rows.length;
  const shown = rows.slice(0, limit);

  const toggleSort = (key: string) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  const SortHead = ({ k, children, style }: { k: string; children: React.ReactNode; style?: React.CSSProperties }) => (
    <th className="sortable" style={style} onClick={() => toggleSort(k)}>
      <span className="th-i">
        {children}
        {sort.key === k && <Icon name={sort.dir === 'asc' ? 'chevronUp' : 'chevronDown'} size={12} />}
      </span>
    </th>
  );

  const allSel = shown.length > 0 && shown.every((t) => selected.has(t.id));
  const someSel = shown.some((t) => selected.has(t.id));
  const toggleAll = () =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (allSel) shown.forEach((t) => n.delete(t.id));
      else shown.forEach((t) => n.add(t.id));
      return n;
    });
  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const chips = [
    fStatus && { k: 'status', label: 'Status', val: STATUS_MAP[fStatus]?.label ?? fStatus, clear: () => setFStatus(null) },
    fPriority && { k: 'priority', label: 'Priority', val: PRIORITY_MAP[fPriority]?.label ?? fPriority, clear: () => setFPriority(null) },
    fType && { k: 'type', label: 'Type', val: TYPE_MAP[fType]?.label ?? fType, clear: () => setFType(null) },
    fAssignee && { k: 'assignee', label: 'Assignee', val: fAssignee === 'none' ? 'Unassigned' : (umap[fAssignee]?.name ?? fAssignee), clear: () => setFAssignee(null) },
  ].filter(Boolean) as { k: string; label: string; val: string; clear: () => void }[];

  const colW = ['28px', '60%', '18%', '18%', '40%', '45%'];

  const [bulkErr, setBulkErr] = useState(false);
  async function bulkPatch(patch: Record<string, unknown>) {
    const ids = [...selected];
    setBulkErr(false);
    try {
      await Promise.all(ids.map((id) => updateTicket(id, patch)));
      setSelected(new Set());
    } catch {
      setBulkErr(true);
    } finally {
      await qc.invalidateQueries({ queryKey: ['tickets'] });
    }
  }

  function exportCsv() {
    const header = ['number', 'title', 'status', 'priority', 'assignee', 'updated'];
    const lines = rows.map((t) => [t.number, JSON.stringify(t.title), t.status, t.priority, t.assigneeId ? (umap[t.assigneeId]?.name ?? '') : '', new Date(t.updatedAt).toISOString()].join(','));
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'tickets.csv'; a.click(); URL.revokeObjectURL(a.href);
  }

  return (
    <div className="page">
      <div className="page-header">
        <div className="ph-top">
          <div>
            <h1 className="ph-title">Tickets</h1>
            <p className="ph-desc">Triage, assign, and resolve the queue.</p>
          </div>
          <div className="ph-actions">
            <Button variant="outline" icon="download" size="sm" onClick={exportCsv}>Export</Button>
            <Button variant="primary" icon="plus" onClick={() => go('tickets', { create: true })}>New ticket</Button>
          </div>
        </div>

        <div className="viewtabs">
          {VIEWS.map((v) => {
            const c = allRows.filter((t) => v.filter(t) && matchesFilters(t)).length;
            return (
              <div key={v.id} className={'viewtab' + (activeView === v.id ? ' active' : '')} onClick={() => { setActiveView(v.id); setLimit(10); }}>
                {v.id === 'breaching' && <span className="pdot" style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--danger)' }} />}
                {v.name}
                <span className="vt-count">{c}</span>
              </div>
            );
          })}
          <div className="viewtab viewtab-add" title="Save current filters as a view"><Icon name="plus" size={15} /></div>
        </div>
      </div>

      <div className="page-pad" style={{ paddingTop: 0 }}>
        <div className="toolbar">
          <div className="tb-input">
            <Icon name="search" size={15} />
            <input placeholder="Search tickets…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <FilterDropdown
            label="Status"
            value={fStatus ? STATUS_MAP[fStatus]?.label : null}
            onChange={setFStatus}
            options={Object.keys(STATUS_MAP).filter((k) => !['new'].includes(k)).map((k) => ({ value: k, label: STATUS_MAP[k].label }))}
          />
          <FilterDropdown
            label="Priority"
            value={fPriority ? PRIORITY_MAP[fPriority]?.label : null}
            onChange={setFPriority}
            options={Object.keys(PRIORITY_MAP).map((k) => ({
              value: k,
              label: PRIORITY_MAP[k].label,
              swatch: k === 'urgent' ? 'var(--danger)' : k === 'high' ? 'var(--warning)' : k === 'medium' ? 'var(--info)' : 'var(--faint-foreground)',
            }))}
          />
          <FilterDropdown
            label="Assignee"
            value={fAssignee ? (fAssignee === 'none' ? 'Unassigned' : (umap[fAssignee]?.name ?? fAssignee)) : null}
            onChange={setFAssignee}
            options={[
              { value: 'none', label: 'Unassigned' },
              ...(usersQ.data ?? [])
                .filter((u) => u.role !== 'requester')
                .map((u) => ({ value: u.id, label: u.name })),
            ]}
          />
          <FilterDropdown
            label="Type"
            value={fType ? TYPE_MAP[fType]?.label : null}
            onChange={setFType}
            options={Object.keys(TYPE_MAP).map((k) => ({ value: k, label: TYPE_MAP[k].label }))}
          />

          <div style={{ flex: 1 }} />
          <Popover
            align="right"
            width={180}
            trigger={<button className="filter-btn" title="Columns"><Icon name="columns" size={15} /></button>}
          >
            {() => (
              <div className="menu">
                {COLUMN_TOGGLES.map((c) => (
                  <div key={c.key} className="menu-item" onClick={() => setCols((s) => ({ ...s, [c.key]: !s[c.key] }))}>
                    {c.label}
                    {cols[c.key] && <span className="check"><Icon name="check" size={14} /></span>}
                  </div>
                ))}
              </div>
            )}
          </Popover>
          <div className="seg" title="Density">
            <button className={density === 'comfortable' ? 'active' : ''} onClick={() => setDensity('comfortable')}>Comfortable</button>
            <button className={density === 'compact' ? 'active' : ''} onClick={() => setDensity('compact')}>Compact</button>
          </div>
        </div>

        {chips.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            {chips.map((c) => (
              <span className="filter-chip" key={c.k}>
                {c.label}: <b>{c.val}</b>
                <span className="x" onClick={c.clear}><Icon name="x" size={13} /></span>
              </span>
            ))}
            <span className="linkbtn" style={{ fontSize: 'var(--t-caption)' }} onClick={() => { setFStatus(null); setFPriority(null); setFType(null); setFAssignee(null); }}>
              Clear all
            </span>
          </div>
        )}

        {!ticketsQ.isLoading && activeView !== 'breaching' && <TriageBanner go={go} />}
        <div className="tablewrap">
          <table className="tbl">
            <thead>
              <tr>
                <th className="col-check">
                  <input type="checkbox" className="cbx" checked={allSel} ref={(el) => { if (el) el.indeterminate = someSel && !allSel; }} onChange={toggleAll} />
                </th>
                <SortHead k="number" style={{ width: 60 }}>#</SortHead>
                <SortHead k="title">Title</SortHead>
                {cols.status && <SortHead k="status" style={{ width: 130 }}>Status</SortHead>}
                {cols.priority && <SortHead k="priority" style={{ width: 110 }}>Priority</SortHead>}
                {cols.assignee && <th style={{ width: 150 }}>Assignee</th>}
                {cols.updated && <SortHead k="updatedAt" style={{ width: 100 }}>Updated</SortHead>}
                <th style={{ width: 44 }}></th>
              </tr>
            </thead>
            <tbody>
              {ticketsQ.isLoading ? (
                <SkeletonRows count={8} cols={colW} />
              ) : ticketsQ.isError ? (
                <tr style={{ cursor: 'default' }}>
                  <td colSpan={8}>
                    <EmptyState
                      icon="alert"
                      title="Could not load tickets"
                      body="There was a problem fetching tickets from the server."
                      action={
                        <Button variant="primary" size="sm" onClick={() => ticketsQ.refetch()}>Try again</Button>
                      }
                    />
                  </td>
                </tr>
              ) : shown.length === 0 ? (
                <tr style={{ cursor: 'default' }}>
                  <td colSpan={8}>
                    <EmptyState
                      icon="inbox"
                      title="No tickets match this view"
                      body="Try clearing filters or switch to another saved view."
                      action={
                        <>
                          <Button variant="outline" size="sm" onClick={() => { setFStatus(null); setFPriority(null); setFType(null); setFAssignee(null); setSearch(''); setActiveView('all'); }}>
                            Clear filters
                          </Button>
                          <Button variant="primary" size="sm" icon="plus" onClick={() => go('tickets', { create: true })}>New ticket</Button>
                        </>
                      }
                    />
                  </td>
                </tr>
              ) : (
                shown.map((t) => {
                  const u = t.assigneeId ? umap[t.assigneeId] : null;
                  const req = t.requesterId ? umap[t.requesterId] : null;
                  const sel = selected.has(t.id);
                  return (
                    <tr key={t.id} className={sel ? 'selected' : ''} onClick={() => go('tickets', { ticketId: t.id })}>
                      <td className="col-check" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" className="cbx" checked={sel} onChange={() => toggleOne(t.id)} />
                      </td>
                      <td className="td-num">{t.number}</td>
                      <td className="td-title">
                        <span className="tt">
                          {t.title}
                        </span>
                        <span className="tsub">{TYPE_MAP[t.type]?.label ?? t.type} · {req?.name ?? '—'}</span>
                      </td>
                      {cols.status && <td><StatusPill status={t.status} /></td>}
                      {cols.priority && <td><PriorityTag priority={t.priority} /></td>}
                      {cols.assignee && (
                        <td>
                          {u ? (
                            <AvatarName user={u} />
                          ) : (
                            <span className="avatar-none"><Icon name="user" size={13} />—</span>
                          )}
                        </td>
                      )}
                      {cols.updated && <td className="td-time" title={absTime(t.updatedAt)}>{relTime(t.updatedAt)}</td>}
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="row-actions">
                          <IconButton name="user" small title="Assign" />
                          <IconButton name="more" small title="More" />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {!ticketsQ.isLoading && shown.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, color: 'var(--muted-foreground)', fontSize: 'var(--t-small)' }}>
            <span className="tabnum">Showing {shown.length} of {total}</span>
            {limit < total && <Button variant="outline" size="sm" onClick={() => setLimit((l) => l + 10)}>Load more</Button>}
          </div>
        )}

        {selected.size > 0 && (
          <div className="bulkbar">
            <span className="count tabnum">{selected.size} selected</span>
            {bulkErr && <span className="danger" style={{ fontSize: 'var(--t-caption)' }}>Some updates failed — try again</span>}
            <span className="bdiv" />
            <Popover
              align="left"
              width={180}
              trigger={<button><Icon name="user" size={15} />Assign</button>}
            >
              {(close) => (
                <div className="menu">
                  <div className="menu-item" onClick={() => { bulkPatch({ assigneeId: null }); close(); }}>Unassigned</div>
                  <div className="menu-div" />
                  {me && (
                    <div className="menu-item" onClick={() => { bulkPatch({ assigneeId: me }); close(); }}>
                      Assign to me
                    </div>
                  )}
                  {(usersQ.data ?? [])
                    .filter((u) => u.role !== 'requester' && u.id !== me)
                    .map((u) => (
                      <div key={u.id} className="menu-item" onClick={() => { bulkPatch({ assigneeId: u.id }); close(); }}>
                        {u.name}
                      </div>
                    ))}
                </div>
              )}
            </Popover>
            <Popover
              align="left"
              width={180}
              trigger={<button><Icon name="checkCircle" size={15} />Status</button>}
            >
              {(close) => (
                <div className="menu">
                  {Object.keys(STATUS_MAP).filter((k) => k !== 'new').map((k) => (
                    <div key={k} className="menu-item" onClick={() => { bulkPatch({ status: k }); close(); }}>
                      {STATUS_MAP[k].label}
                    </div>
                  ))}
                </div>
              )}
            </Popover>
            <Popover
              align="left"
              width={180}
              trigger={<button><Icon name="alert" size={15} />Priority</button>}
            >
              {(close) => (
                <div className="menu">
                  {Object.keys(PRIORITY_MAP).map((k) => (
                    <div key={k} className="menu-item" onClick={() => { bulkPatch({ priority: k }); close(); }}>
                      {PRIORITY_MAP[k].label}
                    </div>
                  ))}
                </div>
              )}
            </Popover>
            <button onClick={() => bulkPatch({ status: 'closed' })}><Icon name="checkCircle" size={15} />Close</button>
            <span className="bdiv" />
            <button onClick={() => setSelected(new Set())}><Icon name="x" size={15} /></button>
          </div>
        )}
      </div>
    </div>
  );
}
