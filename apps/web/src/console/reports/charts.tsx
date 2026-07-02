// SPDX-License-Identifier: AGPL-3.0-only

/* Report chart components + pure helpers.
 * Matches the dashboard's hand-rolled SVG style: CSS vars, viewBox, no chart lib.
 */
import { useState } from 'react';
import type { ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReportRow {
  key: string | null;
  value: number;
}

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested)
// ---------------------------------------------------------------------------

/**
 * Round `max` up to a "nice" axis ceiling.
 * Examples: 0→1, 1→1, 7→10, 23→25, 140→200, 1234→2000.
 */
export function niceMax(max: number): number {
  if (max <= 0) return 1;
  if (max <= 1) return 1;
  // Find magnitude, then pick the next "nice" multiple: 1, 2, 2.5, 5, 10
  const mag = Math.pow(10, Math.floor(Math.log10(max)));
  const nices = [1, 2, 2.5, 5, 10];
  for (const n of nices) {
    if (n * mag >= max) return n * mag;
  }
  return 10 * mag;
}

export interface BarRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Compute bar rects for the given rows inside a (width x height) canvas.
 * Returns one rect per row. Handles max=0 (all bars have h=0).
 */
export function barLayout(rows: ReportRow[], width: number, height: number): BarRect[] {
  if (rows.length === 0) return [];
  const maxVal = niceMax(Math.max(0, ...rows.map((r) => r.value)));
  const n = rows.length;
  const gap = Math.max(2, Math.floor(width * 0.04));
  const barW = Math.max(1, (width - gap * (n + 1)) / n);
  return rows.map((r, i) => {
    const frac = maxVal > 0 ? r.value / maxVal : 0;
    const h = Math.max(0, frac * height);
    return {
      x: gap + i * (barW + gap),
      y: height - h,
      w: barW,
      h,
    };
  });
}

/**
 * Build an SVG path `d` string for a line through `values` in a (width x height) box.
 * Returns empty string when there are fewer than 2 points.
 */
export function linePath(values: number[], width: number, height: number, max: number): string {
  if (values.length < 2) return values.length === 1 ? `M0,${height / 2} L${width},${height / 2}` : '';
  const effMax = max > 0 ? max : niceMax(Math.max(0, ...values));
  const n = values.length;
  const x = (i: number) => (i / (n - 1)) * width;
  const y = (v: number) => height - (effMax > 0 ? (v / effMax) * height : 0);
  return values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
}

export interface PieSlice {
  value: number;
  frac: number;
  start: number; // angle in radians, 0 = top (−π/2)
  end: number;
}

/**
 * Compute pie slices (angles) for a set of rows.
 * start/end are absolute radians, beginning at −π/2 (top).
 * If total=0 all fracs are 0 and the single slice spans 0 arc.
 */
export function pieSlices(rows: ReportRow[]): PieSlice[] {
  const total = rows.reduce((s, r) => s + r.value, 0);
  let a = -Math.PI / 2;
  return rows.map((r) => {
    const frac = total > 0 ? r.value / total : 0;
    const start = a;
    const end = a + frac * Math.PI * 2;
    a = end;
    return { value: r.value, frac, start, end };
  });
}

// ---------------------------------------------------------------------------
// Value formatter (exported)
// ---------------------------------------------------------------------------

/**
 * Format a number with thousands separators; up to 1 decimal for fractional values.
 */
export function formatValue(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  // Show 1 decimal if there's a meaningful fractional part
  const decimals = abs >= 100 ? 0 : abs >= 10 ? 1 : abs >= 1 ? 2 : 2;
  // But if it's an integer, skip decimals
  const showDecimals = n % 1 !== 0 ? decimals : 0;
  return n.toLocaleString('en-US', {
    minimumFractionDigits: showDecimals,
    maximumFractionDigits: showDecimals,
  });
}

// ---------------------------------------------------------------------------
// Pie/donut color palette (CSS-var-style colors, cycling)
// ---------------------------------------------------------------------------

const PIE_COLORS = [
  'var(--primary)',
  'var(--success)',
  'var(--warning)',
  'var(--info)',
  'var(--danger)',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
];

function pieColor(i: number): string {
  return PIE_COLORS[i % PIE_COLORS.length];
}

// ---------------------------------------------------------------------------
// Arc path helper (donut)
// ---------------------------------------------------------------------------

function arcPath(cx: number, cy: number, R: number, r: number, start: number, end: number): string {
  // Clamp to avoid degenerate arcs
  const delta = end - start;
  const safeEnd = delta >= Math.PI * 2 ? start + Math.PI * 2 - 0.0001 : end;
  const large = safeEnd - start > Math.PI ? 1 : 0;
  const cos = Math.cos,
    sin = Math.sin;
  const x0 = cx + R * cos(start),
    y0 = cy + R * sin(start);
  const x1 = cx + R * cos(safeEnd),
    y1 = cy + R * sin(safeEnd);
  const x2 = cx + r * cos(safeEnd),
    y2 = cy + r * sin(safeEnd);
  const x3 = cx + r * cos(start),
    y3 = cy + r * sin(start);
  return `M${x0.toFixed(2)},${y0.toFixed(2)} A${R},${R} 0 ${large} 1 ${x1.toFixed(2)},${y1.toFixed(2)} L${x2.toFixed(2)},${y2.toFixed(2)} A${r},${r} 0 ${large} 0 ${x3.toFixed(2)},${y3.toFixed(2)} Z`;
}

// ---------------------------------------------------------------------------
// Empty state (reused across charts)
// ---------------------------------------------------------------------------

function ChartEmpty({ label }: { label?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: 160,
        color: 'var(--muted-foreground)',
        fontSize: 13,
        gap: 6,
        border: '1px dashed var(--border)',
        borderRadius: 8,
      }}
    >
      <span style={{ fontSize: 22, opacity: 0.4 }}>—</span>
      <span>{label ?? 'No data'}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// BarChart
// ---------------------------------------------------------------------------

const BAR_W = 480;
const BAR_H = 200;
const BAR_PAD_B = 32; // space for x-axis labels
const BAR_PAD_T = 10;
const BAR_PAD_L = 8;

export function BarChart({
  rows,
  renderKey,
  label,
}: {
  rows: ReportRow[];
  renderKey: (key: string | null) => ReactNode;
  label?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (rows.length === 0) return <ChartEmpty label={label ? `No data for "${label}"` : undefined} />;

  const plotH = BAR_H - BAR_PAD_T - BAR_PAD_B;
  const rects = barLayout(rows, BAR_W - BAR_PAD_L * 2, plotH);
  const maxVal = niceMax(Math.max(0, ...rows.map((r) => r.value)));

  return (
    <div>
      {label && <div className="chart-title" style={{ marginBottom: 6 }}>{label}</div>}
      <svg
        viewBox={`0 0 ${BAR_W} ${BAR_H}`}
        width="100%"
        style={{ display: 'block', overflow: 'visible' }}
        onMouseLeave={() => setHover(null)}
      >
        {/* Grid lines */}
        {[0.25, 0.5, 0.75, 1].map((f) => {
          const yy = BAR_PAD_T + (1 - f) * plotH;
          return (
            <g key={f}>
              <line
                x1={BAR_PAD_L}
                x2={BAR_W - BAR_PAD_L}
                y1={yy}
                y2={yy}
                stroke="var(--border)"
                strokeWidth="1"
                strokeDasharray="2 4"
              />
              <text x={BAR_PAD_L} y={yy - 2} fontSize="8" fill="var(--faint-foreground)" textAnchor="start">
                {formatValue(maxVal * f)}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {rects.map((r, i) => {
          const absX = BAR_PAD_L + r.x;
          const absY = BAR_PAD_T + r.y;
          const isHov = hover === i;
          return (
            <g key={i} onMouseEnter={() => setHover(i)}>
              <rect
                x={absX}
                y={absY}
                width={r.w}
                height={r.h}
                fill={isHov ? 'var(--primary)' : 'color-mix(in srgb, var(--primary) 75%, transparent)'}
                rx={2}
              />
              {/* Value label above bar */}
              {r.h > 0 && (
                <text
                  x={absX + r.w / 2}
                  y={absY - 3}
                  fontSize="8"
                  fill="var(--muted-foreground)"
                  textAnchor="middle"
                >
                  {formatValue(rows[i].value)}
                </text>
              )}
              {/* X-axis key label */}
              <foreignObject
                x={absX}
                y={BAR_PAD_T + plotH + 4}
                width={r.w}
                height={BAR_PAD_B - 4}
                style={{ overflow: 'visible' }}
              >
                <div
                  style={{
                    fontSize: 9,
                    color: 'var(--muted-foreground)',
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    width: r.w,
                  }}
                >
                  {renderKey(rows[i].key)}
                </div>
              </foreignObject>
            </g>
          );
        })}

        {/* Hover tooltip */}
        {hover != null && (
          <g>
            {(() => {
              const r = rects[hover];
              const absX = BAR_PAD_L + r.x;
              const tipX = Math.min(absX + r.w / 2 + 4, BAR_W - 90);
              return (
                <g transform={`translate(${tipX}, ${BAR_PAD_T})`}>
                  <rect width="84" height="32" rx="5" fill="var(--foreground)" />
                  <text x="8" y="13" fontSize="8" fill="var(--background)" opacity="0.7">
                    {renderKey(rows[hover].key)}
                  </text>
                  <text x="8" y="25" fontSize="10" fill="var(--background)" fontWeight="600">
                    {formatValue(rows[hover].value)}
                  </text>
                </g>
              );
            })()}
          </g>
        )}
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LineChart
// ---------------------------------------------------------------------------

const LINE_W = 560;
const LINE_H = 200;
const LINE_PAD_B = 22;
const LINE_PAD_T = 10;
const LINE_PAD_X = 8;

export function LineChart({
  rows,
  renderKey,
  label,
}: {
  rows: ReportRow[];
  renderKey: (key: string | null) => ReactNode;
  label?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (rows.length === 0) return <ChartEmpty label={label ? `No data for "${label}"` : undefined} />;

  const plotH = LINE_H - LINE_PAD_T - LINE_PAD_B;
  const plotW = LINE_W - LINE_PAD_X * 2;
  const values = rows.map((r) => r.value);
  const maxVal = niceMax(Math.max(0, ...values));

  const x = (i: number) => LINE_PAD_X + (rows.length > 1 ? (i / (rows.length - 1)) * plotW : plotW / 2);
  const y = (v: number) => LINE_PAD_T + (1 - (maxVal > 0 ? v / maxVal : 0)) * plotH;

  // Build padded line/area paths
  const offsetPath = rows.length >= 2
    ? rows.map((r, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(r.value).toFixed(1)}`).join(' ')
    : '';
  const offsetArea =
    rows.length >= 2
      ? offsetPath +
        ` L${x(rows.length - 1).toFixed(1)},${(LINE_PAD_T + plotH).toFixed(1)} L${x(0).toFixed(1)},${(LINE_PAD_T + plotH).toFixed(1)} Z`
      : '';

  return (
    <div>
      {label && <div className="chart-title" style={{ marginBottom: 6 }}>{label}</div>}
      <svg
        viewBox={`0 0 ${LINE_W} ${LINE_H}`}
        width="100%"
        style={{ display: 'block', overflow: 'visible' }}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="lcA" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={f}
            x1={LINE_PAD_X}
            x2={LINE_W - LINE_PAD_X}
            y1={LINE_PAD_T + f * plotH}
            y2={LINE_PAD_T + f * plotH}
            stroke="var(--border)"
            strokeWidth="1"
            strokeDasharray="2 4"
          />
        ))}

        {/* Area + line */}
        {offsetArea && <path d={offsetArea} fill="url(#lcA)" />}
        {offsetPath && (
          <path
            d={offsetPath}
            fill="none"
            stroke="var(--primary)"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {/* X-axis labels (every other when many) */}
        {rows.map((r, i) => {
          const skip = rows.length > 10 && i % 2 !== 0;
          if (skip) return null;
          return (
            <text key={i} x={x(i)} y={LINE_H - 6} fontSize="9" fill="var(--faint-foreground)" textAnchor="middle">
              {String(renderKey(r.key) ?? r.key ?? '')}
            </text>
          );
        })}

        {/* Hover target rects */}
        {rows.map((_, i) => (
          <rect
            key={i}
            x={x(i) - LINE_W / rows.length / 2}
            y={0}
            width={LINE_W / rows.length}
            height={LINE_H - LINE_PAD_B}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}

        {/* Hover dot + tooltip */}
        {hover != null && (
          <g>
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={LINE_PAD_T}
              y2={LINE_PAD_T + plotH}
              stroke="var(--border-strong)"
              strokeWidth="1"
            />
            <circle
              cx={x(hover)}
              cy={y(rows[hover].value)}
              r="3.5"
              fill="var(--primary)"
              stroke="var(--surface)"
              strokeWidth="1.5"
            />
            <g transform={`translate(${Math.min(x(hover) + 8, LINE_W - 92)}, ${LINE_PAD_T})`}>
              <rect width="86" height="40" rx="6" fill="var(--foreground)" />
              <text x="8" y="15" fontSize="9" fill="var(--background)" opacity="0.7">
                {renderKey(rows[hover].key)}
              </text>
              <text x="8" y="29" fontSize="10" fill="var(--background)" fontWeight="600">
                {formatValue(rows[hover].value)}
              </text>
            </g>
          </g>
        )}
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PieChart (donut)
// ---------------------------------------------------------------------------

export function PieChart({
  rows,
  renderKey,
  label,
}: {
  rows: ReportRow[];
  renderKey: (key: string | null) => ReactNode;
  label?: string;
}) {
  if (rows.length === 0 || rows.every((r) => r.value === 0))
    return <ChartEmpty label={label ? `No data for "${label}"` : undefined} />;

  const cx = 70,
    cy = 70,
    R = 58,
    r = 36;
  const slices = pieSlices(rows);

  return (
    <div>
      {label && <div className="chart-title" style={{ marginBottom: 6 }}>{label}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <svg viewBox="0 0 140 140" width="140" height="140" style={{ flex: 'none' }}>
          {slices.map((s, i) => {
            // If total is 0 or single slice, render a full circle
            if (s.frac <= 0) return null;
            if (s.frac >= 1) {
              // Full circle as two halves
              const top = arcPath(cx, cy, R, r, -Math.PI / 2, Math.PI / 2);
              const bot = arcPath(cx, cy, R, r, Math.PI / 2, Math.PI * 1.5);
              return (
                <g key={i}>
                  <path d={top} fill={pieColor(i)} />
                  <path d={bot} fill={pieColor(i)} />
                </g>
              );
            }
            return <path key={i} d={arcPath(cx, cy, R, r, s.start, s.end)} fill={pieColor(i)} />;
          })}
          {/* Center total */}
          <text x={cx} y={cy - 6} textAnchor="middle" fontSize="18" fontWeight="700" fill="var(--foreground)">
            {formatValue(rows.reduce((s, r) => s + r.value, 0))}
          </text>
          {label && (
            <text x={cx} y={cy + 9} textAnchor="middle" fontSize="8" fill="var(--muted-foreground)">
              {label}
            </text>
          )}
        </svg>
        {/* Legend */}
        <div className="legend" style={{ flexDirection: 'column', gap: 8, flex: 1 }}>
          {rows.map((row, i) => (
            <span className="legend-item" key={i}>
              <span className="lg-dot" style={{ background: pieColor(i) }} />
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {renderKey(row.key)}
              </span>
              <b style={{ marginLeft: 4, flexShrink: 0 }}>{formatValue(row.value)}</b>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NumberStat
// ---------------------------------------------------------------------------

export function NumberStat(props: {
  rows: ReportRow[];
  renderKey: (key: string | null) => ReactNode;
  label?: string;
}) {
  const { rows, label } = props;
  // For single-value reports: show the first (or only) row's value prominently.
  const value = rows.length > 0 ? rows[0].value : null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 24px',
        gap: 8,
      }}
    >
      <div
        style={{
          fontSize: 56,
          fontWeight: 700,
          lineHeight: 1,
          color: 'var(--foreground)',
          letterSpacing: '-2px',
        }}
      >
        {value !== null ? formatValue(value) : '—'}
      </div>
      {label && (
        <div style={{ fontSize: 13, color: 'var(--muted-foreground)', marginTop: 4 }}>{label}</div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ResultTable
// ---------------------------------------------------------------------------

export function ResultTable({
  rows,
  renderKey,
  label,
}: {
  rows: ReportRow[];
  renderKey: (key: string | null) => ReactNode;
  label?: string;
}) {
  if (rows.length === 0) return <ChartEmpty label={label ? `No data for "${label}"` : undefined} />;

  return (
    <div>
      {label && <div className="chart-title" style={{ marginBottom: 6 }}>{label}</div>}
      <div className="tablewrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Key</th>
              <th style={{ textAlign: 'right', width: 120 }}>Value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                <td>{renderKey(row.key)}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {formatValue(row.value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
