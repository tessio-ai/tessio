// SPDX-License-Identifier: AGPL-3.0-only

/* Dashboard — stat cards + area chart + donut + my queue. Real data via /dashboard + the tickets API. */
import { useState } from 'react';
import { Icon } from './icons';
import { StatCard, StatusPill, PriorityTag, EmptyState, dueInfo, relTime } from './ui';
import { AgentBand } from './agent';
import { useDashboard } from './dashboard.queries';
import { useTickets, useTicketSchemas } from './tickets/queries';
import { toDisplayTicket, savedViews } from './tickets/adapt';
import type { AuthUser } from '../auth/api';
import type { Route } from './shell';

type Go = (screen: string, extra?: Partial<Route>) => void;

const STATUS_META: Record<string, { label: string; color: string }> = {
  open: { label: 'Open', color: 'var(--info)' },
  new: { label: 'New', color: 'var(--info)' },
  in_progress: { label: 'In progress', color: 'var(--warning)' },
  pending: { label: 'Pending', color: '#f59e0b' },
  on_hold: { label: 'On hold', color: 'var(--faint-foreground)' },
};

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function AreaChart({ created, resolved, labels }: { created: number[]; resolved: number[]; labels: string[] }) {
  const W = 560,
    Hh = 200,
    padX = 8,
    padB = 22,
    padT = 10;
  const max = Math.max(...created, ...resolved) * 1.15;
  const n = created.length;
  const x = (i: number) => padX + (i * (W - padX * 2)) / (n - 1);
  const y = (v: number) => padT + (1 - v / max) * (Hh - padT - padB);
  const line = (arr: number[]) => arr.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = (arr: number[]) => line(arr) + ` L${x(n - 1)},${Hh - padB} L${x(0)},${Hh - padB} Z`;
  const [hover, setHover] = useState<number | null>(null);
  return (
    <svg viewBox={`0 0 ${W} ${Hh}`} width="100%" style={{ display: 'block', overflow: 'visible' }} onMouseLeave={() => setHover(null)}>
      <defs>
        <linearGradient id="agA" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <line key={f} x1={padX} x2={W - padX} y1={padT + f * (Hh - padT - padB)} y2={padT + f * (Hh - padT - padB)} stroke="var(--border)" strokeWidth="1" strokeDasharray="2 4" />
      ))}
      <path d={area(created)} fill="url(#agA)" />
      <path d={line(created)} fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <path d={line(resolved)} fill="none" stroke="var(--success)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" opacity="0.85" />
      {labels.map((l, i) => i % 2 === 0 && (
        <text key={i} x={x(i)} y={Hh - 6} fontSize="9" fill="var(--faint-foreground)" textAnchor="middle">{l}</text>
      ))}
      {created.map((_, i) => (
        <rect key={i} x={x(i) - W / n / 2} y={0} width={W / n} height={Hh - padB} fill="transparent" onMouseEnter={() => setHover(i)} />
      ))}
      {hover != null && (
        <g>
          <line x1={x(hover)} x2={x(hover)} y1={padT} y2={Hh - padB} stroke="var(--border-strong)" strokeWidth="1" />
          <circle cx={x(hover)} cy={y(created[hover])} r="3.5" fill="var(--primary)" stroke="var(--surface)" strokeWidth="1.5" />
          <circle cx={x(hover)} cy={y(resolved[hover])} r="3.5" fill="var(--success)" stroke="var(--surface)" strokeWidth="1.5" />
          <g transform={`translate(${Math.min(x(hover) + 8, W - 92)}, ${padT})`}>
            <rect width="86" height="40" rx="6" fill="var(--foreground)" />
            <text x="8" y="16" fontSize="9" fill="var(--background)" opacity="0.7">{labels[hover]}</text>
            <text x="8" y="30" fontSize="10" fill="var(--background)" fontWeight="600">{created[hover]} new · {resolved[hover]} done</text>
          </g>
        </g>
      )}
    </svg>
  );
}

function Donut({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const R = 60,
    r = 38,
    cx = 70,
    cy = 70;
  let a0 = -Math.PI / 2;
  const arcs = data.map((d) => {
    const frac = d.value / total;
    const a1 = a0 + frac * Math.PI * 2;
    const large = frac > 0.5 ? 1 : 0;
    const p = (ang: number, rad: number) => [cx + rad * Math.cos(ang), cy + rad * Math.sin(ang)];
    const [x0, y0] = p(a0, R),
      [x1, y1] = p(a1, R);
    const [x2, y2] = p(a1, r),
      [x3, y3] = p(a0, r);
    const path = `M${x0},${y0} A${R},${R} 0 ${large} 1 ${x1},${y1} L${x2},${y2} A${r},${r} 0 ${large} 0 ${x3},${y3} Z`;
    a0 = a1;
    return { ...d, path };
  });
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
      <svg viewBox="0 0 140 140" width="140" height="140" style={{ flex: 'none' }}>
        {arcs.map((d, i) => (
          <path key={i} d={d.path} fill={d.color} />
        ))}
        <text x="70" y="66" textAnchor="middle" fontSize="22" fontWeight="700" fill="var(--foreground)">{total}</text>
        <text x="70" y="82" textAnchor="middle" fontSize="9" fill="var(--muted-foreground)">open</text>
      </svg>
      <div className="legend" style={{ flexDirection: 'column', gap: 8 }}>
        {data.map((d, i) => (
          <span className="legend-item" key={i}>
            <span className="lg-dot" style={{ background: d.color }} />
            {d.label} <b>{d.value}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

export function Dashboard({ go, user }: { go: Go; user?: AuthUser }) {
  const statsQ = useDashboard();
  const s = statsQ.data;
  const me = user?.id ?? null;

  const ticketsQ = useTickets({ limit: 50, sort: { field: 'updatedAt', dir: 'desc', type: 'date' } });
  const schemasQ = useTicketSchemas();
  const typeById = Object.fromEntries((schemasQ.data ?? []).map((sc) => [sc.id, sc.key]));
  const myOpenFilter = savedViews(me).find((v) => v.id === 'my_open')!.filter;
  const queue = (ticketsQ.data?.rows ?? []).map((r) => toDisplayTicket(r, typeById)).filter(myOpenFilter).slice(0, 6);

  const created = s?.series.map((d) => d.created) ?? [];
  const resolved = s?.series.map((d) => d.resolved) ?? [];
  const labels = s?.series.map((d) => { const [, m, day] = d.date.split('-'); return `${+m}/${+day}`; }) ?? [];
  const donut = (s?.openByStatus ?? []).map((r) => ({
    label: STATUS_META[r.status]?.label ?? r.status,
    value: r.count,
    color: STATUS_META[r.status]?.color ?? 'var(--faint-foreground)',
  }));

  const firstName = (user?.name ?? '').trim().split(/\s+/)[0] || 'there';

  return (
    <div className="page">
      <div className="page-header" style={{ paddingBottom: 4 }}>
        <h1 className="ph-title">{greeting()}, {firstName}.</h1>
        <p className="ph-desc">Here's what's on your plate and how the desk is trending.</p>
      </div>
      <div className="page-pad" style={{ paddingTop: 18 }}>
        <AgentBand go={go} tess={s?.tess} today={s?.today} recent={s?.recentTess} />
        <div className="statgrid" style={{ marginTop: 14 }}>
          <StatCard label="My open" icon="ticket" value={s?.myOpen ?? 0} accent="var(--primary)" onClick={() => go('tickets', { view: 'my_open' })} />
          <StatCard label="Unassigned" icon="inbox" value={s?.unassigned ?? 0} onClick={() => go('tickets', { view: 'unassigned' })} />
          <StatCard label="Due today" icon="clock" value={s?.dueToday ?? 0} onClick={() => go('tickets')} />
          <StatCard label="SLA breaching" icon="alert" value={s?.breaching ?? 0} accent="var(--danger)" onClick={() => go('tickets', { view: 'breaching' })} />
        </div>

        <div className="chartgrid">
          <div className="card card-pad">
            <div className="chart-head">
              <div>
                <div className="chart-title">Tickets over time</div>
                <div className="chart-sub">Created vs resolved · last 14 days</div>
              </div>
              <div className="legend">
                <span className="legend-item"><span className="lg-dot" style={{ background: 'var(--primary)' }} />Created</span>
                <span className="legend-item"><span className="lg-dot" style={{ background: 'var(--success)' }} />Resolved</span>
              </div>
            </div>
            <AreaChart created={created} resolved={resolved} labels={labels} />
          </div>
          <div className="card card-pad">
            <div className="chart-head"><div className="chart-title">Open by status</div></div>
            <div style={{ display: 'grid', placeItems: 'center', height: 'calc(100% - 28px)', minHeight: 200 }}>
              <Donut data={donut} />
            </div>
          </div>
        </div>

        <div className="sectiontitle">
          My queue
          <span className="linkbtn" onClick={() => go('tickets', { view: 'my_open' })}>
            View all <Icon name="arrowRight" size={14} />
          </span>
        </div>
        <div className="tablewrap">
          {queue.length === 0 ? (
            <EmptyState
              icon="checkCheck"
              title="Nothing assigned to you"
              body="Tickets assigned to you will show up here. Pick one up from the unassigned queue."
              action={<span className="linkbtn" onClick={() => go('tickets', { view: 'unassigned' })}>View unassigned <Icon name="arrowRight" size={14} /></span>}
            />
          ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 56 }}>#</th>
                <th>Title</th>
                <th style={{ width: 120 }}>Status</th>
                <th style={{ width: 110 }}>Priority</th>
                <th style={{ width: 120 }}>SLA</th>
                <th style={{ width: 90 }}>Updated</th>
              </tr>
            </thead>
            <tbody>
              {queue.map((t) => {
                const due = dueInfo(t.dueAt);
                return (
                  <tr key={t.id} onClick={() => go('tickets', { ticketId: t.id })}>
                    <td className="td-num">{t.number}</td>
                    <td className="td-title"><span className="tt">{t.title}</span></td>
                    <td><StatusPill status={t.status} /></td>
                    <td><PriorityTag priority={t.priority} /></td>
                    <td>{due && <span className={'pill pill-' + (due.tone === 'muted' ? 'neutral' : due.tone)} style={{ height: 20 }}><Icon name="clock" size={11} />{due.label}</span>}</td>
                    <td className="td-time">{relTime(t.updatedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          )}
        </div>
      </div>
    </div>
  );
}
