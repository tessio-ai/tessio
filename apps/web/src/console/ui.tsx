// SPDX-License-Identifier: AGPL-3.0-only

/* UI primitives + helpers. Ported from the design handoff. */
import {
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { Icon } from './icons';
import { USERS, STATUS_MAP, PRIORITY_MAP, TYPE_MAP, type User } from './data';

/* ---- time helpers ---- */
export function relTime(ts: number): string {
  const d = Date.now() - ts;
  const past = d >= 0;
  const a = Math.abs(d);
  const m = 60e3,
    h = 60 * m,
    day = 24 * h;
  let s: string;
  if (a < m) s = 'just now';
  else if (a < h) s = Math.round(a / m) + 'm';
  else if (a < day) s = Math.round(a / h) + 'h';
  else if (a < 7 * day) s = Math.round(a / day) + 'd';
  else s = Math.round(a / (7 * day)) + 'w';
  if (s === 'just now') return s;
  return past ? s + ' ago' : 'in ' + s;
}
export function absTime(ts: number): string {
  return new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
export function dueInfo(ts: number | null) {
  if (!ts) return null;
  const d = ts - Date.now();
  const breached = d < 0;
  const soon = d >= 0 && d < 8 * 3600e3;
  return { label: relTime(ts), tone: breached ? 'danger' : soon ? 'warning' : 'muted', breached };
}

function resolveUser(user?: string | User | null): User | null {
  if (!user) return null;
  return typeof user === 'string' ? USERS[user] ?? null : user;
}

/* ---- Avatar ---- */
export function Avatar({ user, size = 'md' }: { user?: string | User | null; size?: string }) {
  const u = resolveUser(user);
  if (!user) return <span className="avatar-none"><Icon name="user" size={14} /> Unassigned</span>;
  if (!u) return <span className="avatar-none">—</span>;
  return (
    <span className={'avatar ' + size} style={{ background: u.color }} title={u.name}>
      {u.initials}
    </span>
  );
}
export function AvatarName({ user, size = 'sm' }: { user?: string | User | null; size?: string }) {
  const u = resolveUser(user);
  if (!u) return <span className="avatar-none"><Icon name="user" size={13} /> —</span>;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
      <Avatar user={u} size={size} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</span>
    </span>
  );
}
export function AvatarGroup({ ids, max = 3 }: { ids: string[]; max?: number }) {
  const shown = ids.slice(0, max);
  const extra = ids.length - shown.length;
  return (
    <span className="avatar-group">
      {shown.map((id) => (
        <Avatar key={id} user={id} size="sm" />
      ))}
      {extra > 0 && (
        <span className="avatar sm" style={{ background: 'var(--muted-2)', color: 'var(--muted-foreground)' }}>
          +{extra}
        </span>
      )}
    </span>
  );
}

/* ---- StatusPill / PriorityTag / TypeBadge ---- */
export function StatusPill({ status }: { status: string }) {
  const meta = STATUS_MAP[status] || { label: status, tone: 'neutral' };
  return (
    <span className={'pill pill-' + meta.tone}>
      <span className="dot" />
      {meta.label}
    </span>
  );
}
export function PriorityTag({ priority, showLabel = true }: { priority: string; showLabel?: boolean }) {
  const meta = PRIORITY_MAP[priority] || { label: priority };
  return (
    <span className={'prio prio-' + priority}>
      <span className="pdot" />
      {showLabel && meta.label}
    </span>
  );
}
export function TypeBadge({ type }: { type: string }) {
  const meta = TYPE_MAP[type] || { label: type, icon: 'ticket' };
  return (
    <span className="badge">
      <Icon name={meta.icon} size={12} /> {meta.label}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}

/* ---- Button ---- */
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: string;
  size?: string;
  icon?: string;
  iconRight?: string;
};
export function Button({ variant = 'secondary', size, icon, iconRight, children, className = '', ...rest }: ButtonProps) {
  const cls = ['btn', 'btn-' + variant, size === 'sm' && 'btn-sm', className].filter(Boolean).join(' ');
  return (
    <button className={cls} {...rest}>
      {icon && <Icon name={icon} size={size === 'sm' ? 14 : 16} />}
      {children}
      {iconRight && <Icon name={iconRight} size={size === 'sm' ? 14 : 16} />}
    </button>
  );
}
export function IconButton({
  name,
  size = 16,
  small,
  title,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { name: string; size?: number; small?: boolean }) {
  return (
    <button className={'btn-icon' + (small ? ' sm' : '')} title={title} {...rest}>
      <Icon name={name} size={size} />
    </button>
  );
}

/* ---- StatCard ---- */
export function StatCard({
  label,
  icon,
  value,
  delta,
  deltaDir,
  accent,
  onClick,
}: {
  label: string;
  icon?: string;
  value: ReactNode;
  delta?: string;
  deltaDir?: string;
  accent?: string;
  onClick?: () => void;
}) {
  return (
    <div className="statcard" onClick={onClick}>
      {accent && <span className="sc-accent" style={{ background: accent }} />}
      <div className="sc-label">{icon && <Icon name={icon} size={15} />}{label}</div>
      <div className="sc-num">
        {value}
        {delta != null && (
          <span className={'delta ' + (deltaDir || 'flat')}>
            {deltaDir === 'up' && <Icon name="arrowUp" size={11} />}
            {deltaDir === 'down' && <Icon name="arrowUp" size={11} style={{ transform: 'rotate(180deg)' }} />}
            {delta}
          </span>
        )}
      </div>
    </div>
  );
}

/* ---- EmptyState ---- */
export function EmptyState({
  icon = 'inbox',
  title,
  body,
  action,
}: {
  icon?: string;
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="ei"><Icon name={icon} size={22} /></div>
      <h3>{title}</h3>
      {body && <p>{body}</p>}
      {action && <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>{action}</div>}
    </div>
  );
}

/* ---- Skeleton rows ---- */
export function SkeletonRows({ count = 8, cols }: { count?: number; cols: string[] }) {
  return (
    <>
      {[...Array(count)].map((_, i) => (
        <tr key={i} style={{ cursor: 'default' }}>
          {cols.map((w, j) => (
            <td key={j}>
              <div className="skel" style={{ height: 12, width: w }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/* ---- Popover (click-outside) ---- */
export function Popover({
  trigger,
  children,
  align = 'left',
  width,
}: {
  trigger: ReactNode;
  children: ReactNode | ((close: () => void) => ReactNode);
  align?: 'left' | 'right';
  width?: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  const pos: CSSProperties = { position: 'absolute', top: 'calc(100% + 6px)', zIndex: 40, width };
  pos[align] = 0;
  return (
    <span className="tooltip-host" ref={ref} style={{ display: 'inline-flex' }}>
      <span onClick={() => setOpen((o) => !o)} style={{ display: 'inline-flex' }}>
        {trigger}
      </span>
      {open && <div style={pos}>{typeof children === 'function' ? children(() => setOpen(false)) : children}</div>}
    </span>
  );
}
