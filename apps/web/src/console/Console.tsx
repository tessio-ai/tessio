// SPDX-License-Identifier: AGPL-3.0-only

/* App root — routing, theme/density, shortcuts. Ported from the design handoff. */
import { useCallback, useEffect, useRef, useState } from 'react';
import './console.css';
import { isTypingTarget } from './keyboard';
import { Sidebar, TopBar, CommandPalette, Toaster, type Route } from './shell';
import type { AuthUser } from '../auth/api';
import { useAuth } from '../auth/AuthContext';
import { Dashboard } from './dashboard';
import { CreateDrawer, Placeholder } from './create';
import { TicketsList } from './tickets';
import { TicketDetail } from './detail';
import { FormsList } from './forms/FormsList';
import { FormEditor } from './forms/FormEditor';
import { PortalEditor } from './forms/PortalEditor';
import { AssetsList } from './assets/AssetsList';
import { AssetDrawer } from './assets/AssetDrawer';
import { AssetDetail } from './assets/AssetDetail';
import { AssetTypes } from './assets/AssetTypes';
import { DevicesList } from './devices/DevicesList';
import { DeviceDetail } from './devices/DeviceDetail';
import { KnowledgeList } from './knowledge/KnowledgeList';
import { ArticleView } from './knowledge/ArticleView';
import { ArticleEditor } from './knowledge/ArticleEditor';
import { PortalArticle } from './portal/PortalArticle';
import { Settings } from './settings/Settings';
import { WorkflowsList } from './workflows/WorkflowsList';
import { WorkflowEditor } from './workflows/WorkflowEditor';
import { WorkflowRuns } from './workflows/WorkflowRuns';
import { RunDetail } from './workflows/RunDetail';
import { Reports } from './reports/Reports';
import { ReportBuilder } from './reports/ReportBuilder';
import './reports/reports.css';

function routeToHash(r: Route): string {
  if (r.screen === 'workflows') {
    const parts = ['workflows'];
    if (r.workflowId) parts.push(r.workflowId);
    if (r.view === 'runs') parts.push('runs');
    if (r.runId) parts.push(r.runId);
    return '#/' + parts.join('/');
  }
  if (r.screen === 'reports') {
    const parts = ['reports'];
    if (r.reportId) parts.push(r.reportId);
    return '#/' + parts.join('/');
  }
  const parts = [r.screen];
  const id = r.ticketId ?? r.formId ?? r.assetId ?? r.deviceId ?? r.articleId;
  if (id) parts.push(id);
  if (r.view) parts.push(r.view);
  return '#/' + parts.join('/');
}

function hashToRoute(hash: string): Route {
  const raw = hash.replace(/^#\/?/, '');
  if (!raw) return { screen: 'tickets' };
  if (raw.startsWith('workflows')) {
    const [, workflowId, runsSeg, runId] = raw.split('/');
    const route: Route = { screen: 'workflows' };
    if (workflowId) route.workflowId = workflowId;
    if (runsSeg === 'runs') route.view = 'runs';
    if (runId) route.runId = runId;
    return route;
  }
  if (raw.startsWith('reports')) {
    const [, reportId] = raw.split('/');
    const route: Route = { screen: 'reports' };
    if (reportId) route.reportId = reportId;
    return route;
  }
  const [screen, idOrView, maybeView] = raw.split('/');
  const route: Route = { screen };
  if (!idOrView) return route;
  const idKey = { tickets: 'ticketId', forms: 'formId', assets: 'assetId', devices: 'deviceId', knowledge: 'articleId' }[screen];
  if (idKey && maybeView) {
    (route as Record<string, string>)[idKey] = idOrView;
    route.view = maybeView;
  } else if (idKey && idOrView && !['new', 'types', 'homepage'].includes(idOrView)) {
    (route as Record<string, string>)[idKey] = idOrView;
  } else {
    route.view = idOrView;
  }
  return route;
}

export function Console({ user }: { user?: AuthUser }) {
  const { logout } = useAuth();
  const [route, setRoute] = useState<Route>(() => hashToRoute(window.location.hash));
  const [theme, setTheme] = useState(() => localStorage.getItem('tessio.theme') || 'light');
  const [density, setDensity] = useState(() => localStorage.getItem('tessio.density') || 'comfortable');
  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteMode, setPaletteMode] = useState('cmd');
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [toasts, setToasts] = useState<{ id: string; msg: string; link?: string }[]>([]);
  const gChord = useRef(false);

  const addToast = (msg: string, link?: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, msg, link }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  };

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('tessio.theme', theme);
  }, [theme]);
  useEffect(() => {
    document.documentElement.dataset.density = density;
    localStorage.setItem('tessio.density', density);
  }, [density]);
  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  const go: (screen: string, extra?: Partial<Route> & { create?: boolean }) => void = useCallback((screen, extra = {}) => {
    if (extra.create) {
      setCreateOpen(true);
      return;
    }
    setSelected(new Set());
    const { create: _create, ...rest } = extra;
    void _create;
    const next: Route = { screen, ...rest };
    setRoute(next);
    window.history.pushState(null, '', routeToHash(next));
    document.querySelector('.page, .detail')?.scrollTo?.(0, 0);
  }, []);

  useEffect(() => {
    const onPop = () => setRoute(hashToRoute(window.location.hash));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    if (!window.location.hash) window.history.replaceState(null, '', routeToHash(route));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = isTypingTarget(e.target);
      if (e.key === 'Escape') {
        setPaletteOpen(false);
        setCreateOpen(false);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteMode('cmd');
        setPaletteOpen((o) => !o);
        return;
      }
      if (typing) return;
      if (e.key === '/') {
        e.preventDefault();
        setPaletteMode('cmd');
        setPaletteOpen(true);
      } else if (e.key === 'c') {
        e.preventDefault();
        setCreateOpen(true);
      } else if (e.key === 'g') {
        gChord.current = true;
        setTimeout(() => (gChord.current = false), 700);
      } else if (e.key === 't' && gChord.current) {
        go('tickets');
        gChord.current = false;
      } else if (e.key === 'd' && gChord.current) {
        go('dashboard');
        gChord.current = false;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  let content;
  if (route.screen === 'forms') {
    if (route.view === 'homepage') content = <PortalEditor go={go} />;
    else if (route.formId) content = <FormEditor formId={route.formId} go={go} />;
    else content = <FormsList go={go} />;
  }
  else if (route.screen === 'dashboard') content = <Dashboard go={go} user={user} />;
  else if (route.screen === 'tickets' && route.ticketId) content = <TicketDetail ticketId={route.ticketId} go={go} addToast={addToast} />;
  else if (route.screen === 'tickets') content = <TicketsList go={go} route={route} density={density} setDensity={setDensity} selected={selected} setSelected={setSelected} loading={false} me={user?.id ?? null} />;
  else if (route.screen === 'assets' && route.assetId) content = <AssetDetail assetId={route.assetId} go={go} />;
  else if (route.screen === 'assets' && route.view === 'types') content = <AssetTypes go={go} />;
  else if (route.screen === 'assets') content = (
    <>
      <AssetsList go={go} />
      {route.view === 'new' && <AssetDrawer onClose={() => go('assets')} onCreated={(id) => go('assets', { assetId: id })} />}
    </>
  );
  else if (route.screen === 'devices' && route.deviceId) content = <DeviceDetail deviceId={route.deviceId} go={go} />;
  else if (route.screen === 'devices') content = <DevicesList go={go} />;
  else if (route.screen === 'knowledge' && route.articleId && route.view === 'preview') content = <PortalArticle id={route.articleId} onBack={() => go('knowledge', { articleId: route.articleId })} onOpenForm={() => go('tickets', { create: true })} />;
  else if (route.screen === 'knowledge' && route.articleId && route.view === 'edit') content = <ArticleEditor articleId={route.articleId} go={go} />;
  else if (route.screen === 'knowledge' && route.articleId) content = <ArticleView articleId={route.articleId} go={go} />;
  else if (route.screen === 'knowledge' && route.view === 'new') content = <ArticleEditor go={go} />;
  else if (route.screen === 'knowledge') content = <KnowledgeList go={go} />;
  else if (route.screen === 'workflows' && route.workflowId && route.view === 'runs' && route.runId)
    content = <RunDetail workflowId={route.workflowId} runId={route.runId} go={go} />;
  else if (route.screen === 'workflows' && route.workflowId && route.view === 'runs')
    content = <WorkflowRuns workflowId={route.workflowId} go={go} />;
  else if (route.screen === 'workflows' && route.workflowId)
    content = <WorkflowEditor workflowId={route.workflowId} go={go} addToast={addToast} />;
  else if (route.screen === 'workflows') content = <WorkflowsList go={go} />;
  else if (route.screen === 'reports' && route.reportId) content = <ReportBuilder reportId={route.reportId} go={go} />;
  else if (route.screen === 'reports') content = <Reports go={go} />;
  else if (route.screen === 'settings') content = <Settings go={go} route={route} />;
  else content = <Placeholder screen={route.screen} go={go} />;

  return (
    <div className="app" data-collapsed={collapsed}>
      <Sidebar route={route} go={go} collapsed={collapsed} user={user} onLogout={logout} />
      <div className="console-main">
        <TopBar
          route={route}
          go={go}
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          theme={theme}
          toggleTheme={toggleTheme}
          openPalette={() => { setPaletteMode('cmd'); setPaletteOpen(true); }}
          openAsk={() => { setPaletteMode('ask'); setPaletteOpen(true); }}
          openCreate={() => setCreateOpen(true)}
        />
        {content}
      </div>

      {paletteOpen && (
        <CommandPalette
          initialMode={paletteMode}
          onClose={() => setPaletteOpen(false)}
          go={(s, e) => { setPaletteOpen(false); go(s, e); }}
          openCreate={() => setCreateOpen(true)}
          toggleTheme={toggleTheme}
        />
      )}
      {createOpen && <CreateDrawer onClose={() => setCreateOpen(false)} go={go} />}
      <Toaster toasts={toasts} />
    </div>
  );
}
