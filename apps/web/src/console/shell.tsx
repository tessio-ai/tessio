// SPDX-License-Identifier: AGPL-3.0-only

/* App shell — Sidebar, TopBar, CommandPalette, Toaster. Ported from the design handoff. */
import { Fragment, useEffect, useRef, useState } from 'react';
import { Icon } from './icons';
import { IconButton, Kbd } from './ui';
import type { AuthUser } from '../auth/api';
import { useQuery } from '@tanstack/react-query';
import { Orb, ASK_SUGGESTIONS, AskTessResult } from './agent';
import { NotificationBell } from './NotificationBell';
import { TICKETS } from './data';
import { getOrg } from '../api/org';
import { getPortalSettings } from '../api/portal';
import { useAiSettings } from './settings/queries';
import { useDashboard } from './dashboard.queries';

export type Route = { screen: string; ticketId?: string; view?: string; formId?: string; assetId?: string; deviceId?: string; articleId?: string; workflowId?: string; runId?: string; reportId?: string };
type Go = (screen: string, extra?: Partial<Route> & { create?: boolean }) => void;

export const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'tickets', label: 'Tickets', icon: 'ticket' },
  { id: 'assets', label: 'Assets', icon: 'box' },
  { id: 'devices', label: 'Devices', icon: 'laptop' },
  { id: 'knowledge', label: 'Knowledge Base', icon: 'book' },
  { id: 'forms', label: 'Forms', icon: 'form' },
  { id: 'workflows', label: 'Workflows', icon: 'workflow' },
  { id: 'reports', label: 'Reports', icon: 'chart' },
];

const ADMIN_ONLY = new Set(['forms', 'workflows']);

export function Sidebar({
  route,
  go,
  collapsed,
  user,
  onLogout,
}: {
  route: Route;
  go: Go;
  collapsed: boolean;
  user?: AuthUser;
  onLogout?: () => void;
}) {
  const isAdmin = user?.role === 'admin';
  const initials = (user?.name ?? 'User').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  const roleLabel = user ? `${user.role[0].toUpperCase()}${user.role.slice(1)}` : '';
  const { data: org } = useQuery({ queryKey: ['org'], queryFn: getOrg });
  const { data: portal } = useQuery({ queryKey: ['portal-settings'], queryFn: getPortalSettings });
  const { data: dash } = useDashboard();
  const openCount = dash ? dash.openByStatus.reduce((sum, x) => sum + x.count, 0) : undefined;
  const orgName = org?.name ?? 'Tessio';
  const orgTagline = portal?.brandName ?? '';
  const orgMono = portal?.logo ?? orgName[0] ?? 'T';
  const accent = portal?.accent ?? '#4f46e5';
  const logoStyle = (portal?.hero as Record<string, unknown> | undefined)?.logoStyle === 'solid' ? 'solid' : 'gradient';

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--primary', accent);
    const r = parseInt(accent.slice(1, 3), 16), g = parseInt(accent.slice(3, 5), 16), b = parseInt(accent.slice(5, 7), 16);
    root.style.setProperty('--primary-tint', `rgba(${r},${g},${b},0.08)`);
    root.style.setProperty('--primary-hover', accent);
    root.style.setProperty('--ring', accent);
  }, [accent]);

  const logoBg = logoStyle === 'solid' ? accent : `linear-gradient(150deg, ${accent}, #8b5cf6)`;

  return (
    <aside className="sidebar">
      <div className="sb-org" title={orgName + ' — switch org'}>
        <div className="sb-orglogo" style={{ background: logoBg }}>{orgMono}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="sb-orgname">{orgName}</div>
          <div className="sb-orgsub">{orgTagline}</div>
        </div>
        <Icon name="chevronDown" size={15} className="sb-chev" style={{ color: 'var(--faint-foreground)' }} />
      </div>

      <nav className="sb-nav">
        {NAV.filter((n) => isAdmin || !ADMIN_ONLY.has(n.id)).map((n) => (
          <div
            key={n.id}
            className={'nav-item' + (route.screen === n.id ? ' active' : '')}
            onClick={() => go(n.id)}
            title={collapsed ? n.label : undefined}
          >
            <Icon name={n.icon} size={18} />
            <span className="nav-label">{n.label}</span>
            {n.id === 'tickets' && openCount != null && <span className="nav-count tabnum">{openCount}</span>}
          </div>
        ))}
      </nav>

      <div className="sb-footer">
        {isAdmin && (
          <div
            className={'nav-item' + (route.screen === 'settings' ? ' active' : '')}
            onClick={() => go('settings')}
            title={collapsed ? 'Settings' : undefined}
          >
            <Icon name="settings" size={18} />
            <span className="nav-label">Settings</span>
          </div>
        )}
        <div className="sb-user">
          <span className="avatar avatar-md" style={{ background: 'var(--primary)', color: '#fff' }}>{initials}</span>
          <div style={{ flex: 1, minWidth: 0 }} className="nav-label">
            <div className="sb-username">{user?.name ?? 'User'}</div>
            <div className="sb-userrole">{roleLabel}</div>
          </div>
          <button type="button" onClick={onLogout} title="Sign out" style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--faint-foreground)' }}>
            <Icon name="logout" size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}

const BREADCRUMBS: Record<string, string[]> = {
  dashboard: ['Dashboard'],
  tickets: ['Tickets'],
  assets: ['Assets'],
  knowledge: ['Knowledge Base'],
  forms: ['Forms'],
  workflows: ['Workflows'],
  reports: ['Reports'],
  settings: ['Settings'],
};

export function TopBar({
  route,
  go,
  collapsed,
  setCollapsed,
  theme,
  toggleTheme,
  openPalette,
  openAsk,
  openCreate,
}: {
  route: Route;
  go: Go;
  collapsed: boolean;
  setCollapsed: (f: (c: boolean) => boolean) => void;
  theme: string;
  toggleTheme: () => void;
  openPalette: () => void;
  openAsk: () => void;
  openCreate: () => void;
}) {
  let crumbs = BREADCRUMBS[route.screen] || ['Tessio'];
  if (route.screen === 'tickets' && route.ticketId) {
    const t = TICKETS.find((x) => x.id === route.ticketId);
    crumbs = ['Tickets', '#' + (t ? t.number : '')];
  }
  return (
    <header className="topbar">
      <IconButton
        name="chevronsLeft"
        title="Toggle sidebar"
        onClick={() => setCollapsed((c) => !c)}
        style={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform .18s' }}
      />
      <div className="breadcrumb">
        {crumbs.map((c, i) => (
          <Fragment key={i}>
            {i > 0 && <Icon name="chevronRight" size={14} />}
            <span
              className={i === crumbs.length - 1 ? 'bc-cur' : ''}
              onClick={i === 0 && crumbs.length > 1 ? () => go('tickets') : undefined}
              style={i === 0 && crumbs.length > 1 ? { cursor: 'pointer' } : undefined}
            >
              {c}
            </span>
          </Fragment>
        ))}
      </div>

      <div className="tb-search" onClick={openPalette}>
        <Icon name="search" size={15} />
        <span className="ph">Search tickets, assets, actions…</span>
        <Kbd>⌘K</Kbd>
      </div>

      <div className="tb-spacer" />

      <div className="ask-tess-btn" onClick={openAsk} title="Ask Tess (natural-language agent)">
        <Orb size="sm" />
        Ask Tess
      </div>
      <div className="split">
        <button className="btn btn-primary" onClick={openCreate}>
          <Icon name="plus" size={16} />New
        </button>
        <div className="split-caret" onClick={openCreate}>
          <Icon name="chevronDown" size={14} />
        </div>
      </div>
      <NotificationBell go={go} />
      <IconButton name={theme === 'dark' ? 'sun' : 'moon'} title="Toggle theme" onClick={toggleTheme} />
      <IconButton name="help" title="Help & shortcuts" />
    </header>
  );
}

/* ---- Command palette + Ask Tess ---- */
export function CommandPalette({
  onClose,
  go,
  openCreate,
  toggleTheme,
  initialMode = 'cmd',
}: {
  onClose: () => void;
  go: Go;
  openCreate: () => void;
  toggleTheme: () => void;
  initialMode?: string;
}) {
  const { data: aiSettings } = useAiSettings();
  const askEnabled = !!aiSettings?.enabled && !!aiSettings.features.ask;
  const askLoading = aiSettings === undefined;
  const [mode, setMode] = useState(initialMode);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const [asked, setAsked] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, [mode]);

  const actions = [
    { group: 'Navigate', icon: 'dashboard', label: 'Go to Dashboard', run: () => go('dashboard'), hint: undefined as string | undefined, sub: undefined as string | undefined },
    { group: 'Navigate', icon: 'ticket', label: 'Go to Tickets', run: () => go('tickets'), hint: 'G T', sub: undefined },
    { group: 'Navigate', icon: 'box', label: 'Go to Assets', run: () => go('assets'), hint: undefined, sub: undefined },
    { group: 'Navigate', icon: 'settings', label: 'Go to Settings', run: () => go('settings'), hint: undefined, sub: undefined },
    { group: 'Actions', icon: 'plus', label: 'Create new ticket', run: () => openCreate(), hint: 'C', sub: undefined },
    { group: 'Actions', icon: 'user', label: 'Assign to me', run: () => {}, hint: undefined, sub: undefined },
    { group: 'Actions', icon: 'checkCircle', label: 'Set status…', run: () => {}, hint: undefined, sub: undefined },
    { group: 'Actions', icon: 'moon', label: 'Toggle theme', run: () => toggleTheme(), hint: undefined, sub: undefined },
  ];
  const records = TICKETS.slice(0, 6).map((t) => ({
    group: 'Tickets',
    icon: 'ticket',
    label: t.title,
    sub: '#' + t.number,
    hint: undefined as string | undefined,
    run: () => go('tickets', { ticketId: t.id }),
  }));
  const all = [...actions, ...records];
  const filtered = q ? all.filter((a) => (a.label + (a.sub || '')).toLowerCase().includes(q.toLowerCase())) : all;
  const groups = [...new Set(filtered.map((a) => a.group))];

  useEffect(() => {
    setSel(0);
  }, [q]);
  const onKey = (e: React.KeyboardEvent) => {
    if (mode === 'ask') {
      if (e.key === 'Enter' && q.trim() && askEnabled) {
        e.preventDefault();
        setAsked(q);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSel((s) => Math.min(s + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSel((s) => Math.max(s - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const a = filtered[sel];
      if (a) {
        a.run();
        onClose();
      }
    }
  };

  let idx = -1;
  return (
    <>
      <div className="scrim" onClick={onClose} style={{ zIndex: 60 }} />
      <div className="palette" role="dialog" aria-label="Command palette">
        <div className="ask-modes">
          <div className={'ask-mode' + (mode === 'cmd' ? ' active' : '')} onClick={() => { setMode('cmd'); setAsked(null); setQ(''); }}>
            <Icon name="command" size={14} />Commands
          </div>
          <div
            className={'ask-mode' + (mode === 'ask' ? ' active' : '') + (askEnabled ? '' : ' disabled')}
            onClick={() => { if (askEnabled) { setMode('ask'); setAsked(null); setQ(''); } }}
            title={askEnabled ? undefined : 'Enable Ask Tess in Settings → Tess AI'}
          >
            <Icon name="sparkles" size={14} />Ask Tess
          </div>
        </div>
        <div className="palette-input">
          {mode === 'ask' ? <Orb size="sm" /> : <Icon name="search" size={18} style={{ color: 'var(--muted-foreground)' }} />}
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => { setQ(e.target.value); setAsked(null); }}
            onKeyDown={onKey}
            placeholder={mode === 'ask' ? 'Ask Tess to do something across the queue…' : 'Type a command or search…'}
          />
          <Kbd>esc</Kbd>
        </div>

        {mode === 'ask' ? (
          asked ? (
            <AskTessResult key={asked} query={asked} onOpenTicket={(id) => { go('tickets', { ticketId: id }); onClose(); }} />
          ) : !askEnabled && !askLoading ? (
            <div className="ask-suggest">
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 'var(--t-small)' }}>
                Ask Tess is turned off. Enable it in Settings → Tess AI.
              </div>
            </div>
          ) : (
            <div className="ask-suggest">
              <div className="palette-group">Try asking</div>
              {ASK_SUGGESTIONS.map((s, i) => (
                <div className="as-row" key={i} onClick={() => { if (askEnabled) { setQ(s.q); setAsked(s.q); } }}>
                  <Icon name={s.icon} size={16} style={{ color: 'var(--ai-text)' }} />
                  {s.q}
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="palette-list">
            {filtered.length === 0 && (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 'var(--t-small)' }}>No results for "{q}"</div>
            )}
            {groups.map((g) => (
              <div key={g}>
                <div className="palette-group">{g}</div>
                {filtered
                  .filter((a) => a.group === g)
                  .map((a) => {
                    idx++;
                    const i = idx;
                    return (
                      <div
                        key={a.label}
                        className={'palette-item' + (sel === i ? ' active' : '')}
                        onMouseEnter={() => setSel(i)}
                        onClick={() => { a.run(); onClose(); }}
                      >
                        <Icon name={a.icon} size={16} />
                        <span>{a.label}</span>
                        {a.sub && <span className="pi-sub mono">{a.sub}</span>}
                        <span className="pi-spacer" />
                        {a.hint && <Kbd>{a.hint}</Kbd>}
                      </div>
                    );
                  })}
              </div>
            ))}
          </div>
        )}

        <div className="palette-foot">
          <span className="pf-i"><Kbd>↑</Kbd><Kbd>↓</Kbd> navigate</span>
          <span className="pf-i"><Kbd>↵</Kbd> {mode === 'ask' ? 'ask' : 'select'}</span>
          <span className="pf-i" style={{ marginLeft: 'auto' }}>{mode === 'ask' ? 'Tess searches across your whole queue' : 'esc to close'}</span>
        </div>
      </div>
    </>
  );
}

/* ---- Toaster ---- */
export function Toaster({ toasts }: { toasts: { id: string; msg: string; link?: string }[] }) {
  return (
    <div className="toaster">
      {toasts.map((t) => (
        <div className="toast" key={t.id}>
          <span className="t-ico" style={{ background: 'var(--success-tint)', color: 'var(--success)' }}>
            <Icon name="checkCircle" size={16} />
          </span>
          <span>{t.msg}</span>
          {t.link && <span className="t-link">{t.link}</span>}
        </div>
      ))}
    </div>
  );
}
