// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useState, type MouseEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '../icons';
import { Button, IconButton } from '../ui';
import { useAuth } from '../../auth/AuthContext';
import type { Route } from '../shell';
import { listSchemas } from '../../api/schemas';
import { listTeamMembers } from '../../api/team-members';
import type { ImportUserInput, ImportUsersResult } from '../../api/users';
import {
  useOrg, useUpdateOrg,
  usePortalSettings, useUpdatePortalSettings,
  useUsers, useCreateUser, useUpdateUser, useImportUsers,
  useTeams, useCreateTeam, useDeleteTeam,
  useTeamMembers, useAddTeamMember, useRemoveTeamMember,
  useTeamSchemas, useAddTeamSchema, useRemoveTeamSchema,
  useEntitlements,
} from './queries';
import { TessAiSettings } from './TessAiSettings';
import { SecretsSettings } from './SecretsSettings';
import { EmailSettings } from './EmailSettings';
import { NotificationSettings } from './NotificationSettings';
import { SlaSettings } from './SlaSettings';
import { EeSsoSettings, EeAuditLog } from './ee-bridge';
import { EndpointAgentsSettings } from './EndpointAgentsSettings';

type Go = (screen: string, extra?: Partial<Route>) => void;

const SET_SECTIONS = [
  { group: 'Workspace', items: [
    { id: 'branding', label: 'Branding', icon: 'star' },
    { id: 'members', label: 'Members', icon: 'user' },
    { id: 'teams', label: 'Teams', icon: 'building' },
    { id: 'tess', label: 'Tess AI', icon: 'sparkles' },
    { id: 'email', label: 'Email', icon: 'mail' },
    { id: 'sla', label: 'SLA', icon: 'clock' },
    { id: 'secrets', label: 'Secrets', icon: 'lock' },
    { id: 'agents', label: 'Endpoint agents', icon: 'laptop' },
    { id: 'sso', label: 'Single sign-on', icon: 'shieldCheck' },
    { id: 'audit', label: 'Audit log', icon: 'history' },
  ]},
  { group: 'Account', items: [
    { id: 'notifications', label: 'Notifications', icon: 'bell' },
    { id: 'billing', label: 'License', icon: 'tag' },
  ]},
];

const ACCENT_PRESETS = [
  { name: 'Indigo', value: '#4f46e5' },
  { name: 'Blue', value: '#2563eb' },
  { name: 'Violet', value: '#7c3aed' },
  { name: 'Teal', value: '#0d9488' },
  { name: 'Emerald', value: '#059669' },
  { name: 'Amber', value: '#d97706' },
  { name: 'Rose', value: '#e11d48' },
  { name: 'Slate', value: '#475569' },
];

const DEFAULTS = { name: 'Acme Corp', tagline: 'IT Service Desk', mono: 'A', accent: '#4f46e5', logoStyle: 'gradient' as const };

export function Settings({ go, route }: { go: Go; route: Route }) {
  const section = route.view || 'branding';
  const setSection = (id: string) => go('settings', { view: id });

  // Enterprise features are gated by edition entitlements, never by seats.
  const { data: ent } = useEntitlements();
  const ssoOn = !!ent?.features.sso;
  const auditOn = !!ent?.features.audit_log;

  // Hide enterprise nav items unless entitled.
  const sections = SET_SECTIONS.map((g) => ({
    ...g,
    items: g.items.filter((it) => (it.id === 'sso' ? ssoOn : it.id === 'audit' ? auditOn : true)),
  }));

  let body;
  if (section === 'branding') body = <BrandingSettings />;
  else if (section === 'members') body = <MembersSettings />;
  else if (section === 'teams') body = <TeamsSettings />;
  else if (section === 'tess') body = <TessAiSettings />;
  else if (section === 'email') body = <EmailSettings />;
  else if (section === 'sla') body = <SlaSettings />;
  else if (section === 'secrets') body = <SecretsSettings />;
  else if (section === 'agents') body = <EndpointAgentsSettings />;
  else if (section === 'sso') body = ssoOn ? <EeSsoSettings /> : <BrandingSettings />;
  else if (section === 'audit') body = auditOn ? <EeAuditLog /> : <BrandingSettings />;
  else if (section === 'notifications') body = <NotificationSettings />;
  else body = <BillingSettings />;

  return (
    <div className="settings">
      <nav className="set-nav">
        {sections.map((g) => (
          <div key={g.group}>
            <div className="set-navlabel">{g.group}</div>
            {g.items.map((it) => (
              <div key={it.id} className={'set-navitem' + (section === it.id ? ' active' : '')} onClick={() => setSection(it.id)}>
                <Icon name={it.icon} size={16} className="ico" />{it.label}
              </div>
            ))}
          </div>
        ))}
      </nav>
      <div className="set-body">
        <div className="set-inner">{body}</div>
      </div>
    </div>
  );
}

/* ---------- Branding ---------- */
interface BrandingDraft { name: string; tagline: string; mono: string; accent: string; logoStyle: 'gradient' | 'solid' }

function BrandingSettings() {
  const { data: org } = useOrg();
  const { data: portal } = usePortalSettings();
  const updateOrg = useUpdateOrg();
  const updatePortal = useUpdatePortalSettings();

  const [draft, setDraft] = useState<BrandingDraft | null>(null);

  useEffect(() => {
    if (org && portal && !draft) {
      setDraft({
        name: org.name,
        tagline: portal.brandName,
        mono: portal.logo ?? '',
        accent: portal.accent,
        logoStyle: (portal.hero as Record<string, unknown>)?.logoStyle === 'solid' ? 'solid' : 'gradient',
      });
    }
  }, [org, portal]);

  if (!org || !portal || !draft) return <div className="page-pad muted">Loading…</div>;

  const set = <K extends keyof BrandingDraft>(k: K, v: BrandingDraft[K]) => setDraft((d) => d && ({ ...d, [k]: v }));

  const dirty = draft.name !== org.name
    || draft.tagline !== portal.brandName
    || draft.mono !== (portal.logo ?? '')
    || draft.accent !== portal.accent
    || draft.logoStyle !== ((portal.hero as Record<string, unknown>)?.logoStyle === 'solid' ? 'solid' : 'gradient');

  const saving = updateOrg.isPending || updatePortal.isPending;

  const save = () => {
    if (draft.name !== org.name) updateOrg.mutate({ name: draft.name });
    const portalPatch: Record<string, unknown> = {};
    if (draft.tagline !== portal.brandName) portalPatch.brandName = draft.tagline;
    if (draft.mono !== (portal.logo ?? '')) portalPatch.logo = draft.mono;
    if (draft.accent !== portal.accent) portalPatch.accent = draft.accent;
    if (draft.logoStyle !== ((portal.hero as Record<string, unknown>)?.logoStyle === 'solid' ? 'solid' : 'gradient')) {
      portalPatch.hero = { ...(portal.hero as Record<string, unknown>), logoStyle: draft.logoStyle };
    }
    if (Object.keys(portalPatch).length) updatePortal.mutate(portalPatch);
  };

  const resetDefaults = () => setDraft({ ...DEFAULTS });

  const logoBg = draft.logoStyle === 'solid'
    ? draft.accent
    : `linear-gradient(150deg, ${draft.accent}, #8b5cf6)`;

  return (
    <>
      <h1 className="set-h">Branding</h1>
      <p className="set-h-desc">Your logo, name, and accent color — applied across the console and the help center.</p>

      <div className="set-card">
        <div className="set-card-body">
          <div className="set-row">
            <div><div className="sr-label">Company name</div><div className="sr-hint">Shown in the sidebar and the requester help center.</div></div>
            <div>
              <input className="input" value={draft.name} onChange={(e) => set('name', e.target.value)} placeholder="Company name" style={{ maxWidth: 320 }} />
              <input className="input" value={draft.tagline} onChange={(e) => set('tagline', e.target.value)} placeholder="Tagline (e.g. IT Service Desk)" style={{ maxWidth: 320, marginTop: 8 }} />
            </div>
          </div>

          <div className="set-row">
            <div><div className="sr-label">Logo</div><div className="sr-hint">A 1–2 character monogram and its fill.</div></div>
            <div className="logo-controls">
              <div className="logo-preview" style={{ background: logoBg }}>{draft.mono || draft.name[0] || 'T'}</div>
              <div>
                <input className="input mono-input" maxLength={2} value={draft.mono} onChange={(e) => set('mono', e.target.value.toUpperCase())} />
                <div className="seg" style={{ marginTop: 8 }}>
                  <button className={draft.logoStyle === 'gradient' ? 'active' : ''} onClick={() => set('logoStyle', 'gradient')}>Gradient</button>
                  <button className={draft.logoStyle === 'solid' ? 'active' : ''} onClick={() => set('logoStyle', 'solid')}>Solid</button>
                </div>
              </div>
            </div>
          </div>

          <div className="set-row">
            <div><div className="sr-label">Theme color</div><div className="sr-hint">Recolors primary buttons, links, active nav, and focus rings.</div></div>
            <div className="accent-grid">
              {ACCENT_PRESETS.map((a) => (
                <span key={a.value} className={'accent-sw' + (draft.accent.toLowerCase() === a.value ? ' on' : '')} title={a.name}
                  style={{ background: a.value }} onClick={() => set('accent', a.value)}>
                  {draft.accent.toLowerCase() === a.value && <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#fff' }}><Icon name="check" size={16} /></span>}
                </span>
              ))}
              <label className="accent-custom">
                Custom
                <input type="color" value={draft.accent} onChange={(e) => set('accent', e.target.value)} />
              </label>
            </div>
          </div>
        </div>
        <div className="set-card-foot">
          <Button variant="outline" size="sm" icon="refresh" onClick={resetDefaults}>Reset to defaults</Button>
          <Button variant="primary" size="sm" onClick={save} disabled={!dirty || saving}>{dirty ? 'Save changes' : 'Saved'}</Button>
        </div>
      </div>

      <div className="set-card">
        <div className="set-card-head"><div className="set-card-title">Live preview</div><div className="set-card-sub">How the workspace looks right now.</div></div>
        <div className="set-card-body">
          <div className="brand-preview">
            <div className="bp-bar">
              <div className="bp-logo" style={{ background: logoBg }}>{draft.mono || draft.name[0] || 'T'}</div>
              <div style={{ flex: 1 }}><div className="bp-name">{draft.name || 'Your Company'}</div><div className="bp-sub">{draft.tagline || 'Tagline'}</div></div>
            </div>
            <div className="bp-body">
              <div className="bp-navitem active"><Icon name="ticket" size={16} />Tickets</div>
              <div className="bp-navitem"><Icon name="book" size={16} />Knowledge Base</div>
              <div className="bp-actions">
                <Button variant="primary" size="sm" icon="plus">New ticket</Button>
                <span className="pill pill-info" style={{ height: 22 }}><span className="dot" />Open</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ---------- Members ---------- */
function MembersSettings() {
  const { user: me } = useAuth();
  const { data: users = [] } = useUsers();
  const { data: teams = [] } = useTeams();
  const createUserMut = useCreateUser();
  const updateUserMut = useUpdateUser();
  const [tab, setTab] = useState('all');
  const [q, setQ] = useState('');
  const [inviting, setInviting] = useState(false);
  const [importingUsers, setImportingUsers] = useState(false);

  const { data: allTeamMembers = [] } = useQuery({
    queryKey: ['all-team-members'],
    queryFn: async () => {
      const results = await Promise.all(teams.map((t) => listTeamMembers(t.id)));
      return results.flat();
    },
    enabled: teams.length > 0,
  });
  const userTeams = (userId: string) => {
    const tIds = allTeamMembers.filter((m) => m.userId === userId).map((m) => m.teamId);
    return teams.filter((t) => tIds.includes(t.id));
  };

  const agents = users.filter((u) => u.role !== 'requester');
  const requesters = users.filter((u) => u.role === 'requester');
  let rows = tab === 'agents' ? agents : tab === 'requesters' ? requesters : users;
  if (q) rows = rows.filter((u) => (u.name + ' ' + u.email).toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div><h1 className="set-h">Members</h1><p className="set-h-desc">{agents.length} agents · {requesters.length} requesters</p></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="outline" icon="inbox" onClick={() => setImportingUsers(true)}>Import</Button>
          <Button variant="primary" icon="userPlus" onClick={() => setInviting(true)}>Invite member</Button>
        </div>
      </div>

      <div className="mem-toolbar">
        <div className="mem-tabs">
          <button className={tab === 'all' ? 'active' : ''} onClick={() => setTab('all')}>All <span className="cnt">{users.length}</span></button>
          <button className={tab === 'agents' ? 'active' : ''} onClick={() => setTab('agents')}>Agents <span className="cnt">{agents.length}</span></button>
          <button className={tab === 'requesters' ? 'active' : ''} onClick={() => setTab('requesters')}>Requesters <span className="cnt">{requesters.length}</span></button>
        </div>
        <div className="tb-input" style={{ marginLeft: 'auto' }}>
          <Icon name="search" size={15} />
          <input placeholder="Search members…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <div className="mem-list">
        <div className="mem-row head">
          <div>Member</div><div>Role</div><div className="h-team">Teams</div><div className="h-team">Status</div><div className="h-last">Joined</div><div></div>
        </div>
        {rows.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 'var(--t-small)' }}>No members found.</div>
        ) : rows.map((u) => {
          const isMe = u.id === me?.id;
          const initials = u.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
          return (
            <div className="mem-row" key={u.id}>
              <div className="mem-person">
                <span className="avatar md" style={{ background: 'var(--primary)', color: '#fff' }}>{initials}</span>
                <div style={{ minWidth: 0 }}>
                  <div className="mem-name">{u.name}{isMe && <span className="you-chip">You</span>}</div>
                  <div className="mem-email">{u.email}</div>
                </div>
              </div>
              <div>
                <select className="select mem-rolesel" value={u.role} disabled={isMe}
                  onChange={(e) => updateUserMut.mutate({ id: u.id, role: e.target.value as 'admin' | 'agent' | 'requester' })}>
                  <option value="admin">Admin</option>
                  <option value="agent">Agent</option>
                  <option value="requester">Requester</option>
                </select>
              </div>
              <div className="mem-team">
                {userTeams(u.id).length > 0
                  ? userTeams(u.id).map((t) => <span key={t.id} className="team-chip">{t.name}</span>)
                  : <span style={{ color: 'var(--faint-foreground)' }}>—</span>}
              </div>
              <div className="mem-team">
                <span className={'pill pill-' + (u.status === 'active' ? 'success' : 'neutral')} style={{ height: 20 }}>
                  <span className="dot" />{u.status}
                </span>
              </div>
              <div className="mem-last">{new Date(u.createdAt).toLocaleDateString()}</div>
              <div>
                {!isMe && (
                  <IconButton name={u.status === 'active' ? 'lock' : 'check'} title="Toggle status"
                    onClick={() => updateUserMut.mutate({ id: u.id, status: u.status === 'active' ? 'disabled' : 'active' })} />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {inviting && <InviteDialog teams={teams.map((t) => t.name)} onClose={() => setInviting(false)} onAdd={(body) => {
        createUserMut.mutate(body, { onSuccess: () => setInviting(false) });
      }} />}

      {importingUsers && <ImportUsersDialog onClose={() => setImportingUsers(false)} />}
    </>
  );
}

const VALID_ROLES = ['admin', 'agent', 'requester'] as const;

/** Parse pasted/uploaded CSV into import rows. Accepts an optional header row;
 *  without a header the column order is name, email, role. Role defaults to "agent". */
function parseUsersCsv(text: string): { rows: ImportUserInput[]; errors: string[] } {
  const rows: ImportUserInput[] = [];
  const errors: string[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return { rows, errors };

  const cells = (line: string) => line.split(',').map((c) => c.trim().replace(/^"(.*)"$/, '$1'));
  let idx = { name: 0, email: 1, role: 2 };
  let start = 0;
  const first = cells(lines[0]).map((c) => c.toLowerCase());
  if (first.some((c) => c === 'email' || c === 'e-mail')) {
    idx = {
      name: first.findIndex((c) => c === 'name' || c === 'full name'),
      email: first.findIndex((c) => c === 'email' || c === 'e-mail'),
      role: first.findIndex((c) => c === 'role'),
    };
    start = 1;
  }

  for (let i = start; i < lines.length; i++) {
    const c = cells(lines[i]);
    const name = idx.name >= 0 ? c[idx.name] ?? '' : '';
    const email = idx.email >= 0 ? c[idx.email] ?? '' : '';
    const roleRaw = (idx.role >= 0 ? c[idx.role] ?? '' : '').toLowerCase() || 'agent';
    const lineNo = i + 1;
    if (!email) { errors.push(`Line ${lineNo}: missing email`); continue; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { errors.push(`Line ${lineNo}: invalid email "${email}"`); continue; }
    if (!name) { errors.push(`Line ${lineNo}: missing name`); continue; }
    if (!VALID_ROLES.includes(roleRaw as (typeof VALID_ROLES)[number])) {
      errors.push(`Line ${lineNo}: invalid role "${roleRaw}" (use admin, agent, or requester)`); continue;
    }
    rows.push({ name, email, role: roleRaw as ImportUserInput['role'] });
  }
  return { rows, errors };
}

function ImportUsersDialog({ onClose }: { onClose: () => void }) {
  const importMut = useImportUsers();
  const [text, setText] = useState('');
  const [result, setResult] = useState<ImportUsersResult | null>(null);
  const { rows, errors } = parseUsersCsv(text);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result ?? ''));
    reader.readAsText(file);
    e.target.value = '';
  };

  const submit = () => {
    if (rows.length === 0) return;
    importMut.mutate(rows, { onSuccess: (r) => setResult(r) });
  };

  const credsCsv = () =>
    'email,password\n' + (result?.created ?? []).map((u) => `${u.email},${u.password}`).join('\n');
  const copyCreds = () => { void navigator.clipboard?.writeText(credsCsv()); };
  const downloadCreds = () => {
    const blob = new Blob([credsCsv()], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'imported-credentials.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <>
      <div className="scrim" style={{ zIndex: 60 }} onClick={onClose} />
      <div className="dialog" role="dialog" aria-label="Import members" style={{ width: 560, maxWidth: '92vw' }}>
        <div className="dialog-head">
          <div className="dialog-title">{result ? 'Import complete' : 'Import members'}</div>
          <IconButton name="x" onClick={onClose} />
        </div>

        {!result ? (
          <>
            <div className="dialog-body">
              <div style={{ fontSize: 'var(--t-caption)', color: 'var(--muted-foreground)', marginBottom: 8 }}>
                Paste CSV rows (or load a .csv). Columns: <b>name, email, role</b>. A header row is optional;
                role defaults to <b>agent</b>. Each new user gets a generated password shown after import.
              </div>
              <textarea
                className="input"
                style={{ minHeight: 150, fontFamily: 'var(--font-mono, monospace)', fontSize: 'var(--t-small)', resize: 'vertical' }}
                placeholder={'name,email,role\nJordan Lee,jordan@company.com,agent\nSam Patel,sam@company.com,admin'}
                value={text}
                onChange={(e) => setText(e.target.value)}
                autoFocus
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
                <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer' }}>
                  <Icon name="paperclip" size={14} /> Load .csv
                  <input type="file" accept=".csv,text/csv" onChange={onFile} style={{ display: 'none' }} />
                </label>
                <span style={{ fontSize: 'var(--t-caption)', color: 'var(--muted-foreground)' }}>
                  {rows.length} ready{errors.length > 0 ? ` · ${errors.length} with errors` : ''}
                </span>
              </div>
              {errors.length > 0 && (
                <div style={{ marginTop: 8, maxHeight: 96, overflow: 'auto', fontSize: 'var(--t-caption)', color: 'var(--danger)' }}>
                  {errors.slice(0, 12).map((er, i) => <div key={i}>{er}</div>)}
                  {errors.length > 12 && <div>…and {errors.length - 12} more</div>}
                </div>
              )}
              {importMut.isError && <div style={{ marginTop: 8, fontSize: 'var(--t-caption)', color: 'var(--danger)' }}>Import failed — please try again.</div>}
            </div>
            <div className="dialog-foot">
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button variant="primary" icon="inbox" disabled={rows.length === 0 || importMut.isPending} onClick={submit}>
                {importMut.isPending ? 'Importing…' : `Import ${rows.length || ''}`.trim()}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="dialog-body">
              <div style={{ fontSize: 'var(--t-small)', marginBottom: 10 }}>
                <b>{result.created.length}</b> created · <b>{result.skipped.length}</b> skipped
              </div>
              {result.created.length > 0 && (
                <>
                  <div style={{ fontSize: 'var(--t-caption)', color: 'var(--muted-foreground)', marginBottom: 6 }}>
                    Copy or download these credentials now — passwords are shown only once.
                  </div>
                  <div style={{ maxHeight: 200, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--r-md)' }}>
                    <table className="tbl" style={{ width: '100%' }}>
                      <thead><tr><th style={{ textAlign: 'left' }}>Email</th><th style={{ textAlign: 'left' }}>Password</th></tr></thead>
                      <tbody>
                        {result.created.map((u) => (
                          <tr key={u.email}><td>{u.email}</td><td style={{ fontFamily: 'var(--font-mono, monospace)' }}>{u.password}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <Button variant="outline" size="sm" icon="copy" onClick={copyCreds}>Copy credentials</Button>
                    <Button variant="outline" size="sm" icon="download" onClick={downloadCreds}>Download CSV</Button>
                  </div>
                </>
              )}
              {result.skipped.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 'var(--t-caption)', color: 'var(--muted-foreground)', marginBottom: 4 }}>Skipped</div>
                  <div style={{ maxHeight: 120, overflow: 'auto', fontSize: 'var(--t-caption)', color: 'var(--muted-foreground)' }}>
                    {result.skipped.map((s) => <div key={s.email}>{s.email} — {s.reason}</div>)}
                  </div>
                </div>
              )}
            </div>
            <div className="dialog-foot">
              <Button variant="primary" onClick={onClose}>Done</Button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function InviteDialog({ onClose, onAdd }: {
  teams: string[];
  onClose: () => void;
  onAdd: (b: { name: string; email: string; role: 'admin' | 'agent' | 'requester'; password: string }) => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'agent' | 'requester'>('agent');

  const submit = () => {
    if (!name.trim() || !email.trim()) return;
    const password = crypto.randomUUID().slice(0, 12) + 'Aa1!';
    onAdd({ name: name.trim(), email: email.trim(), role, password });
  };

  return (
    <>
      <div className="scrim" style={{ zIndex: 60 }} onClick={onClose} />
      <div className="dialog" role="dialog" aria-label="Invite member">
        <div className="dialog-head">
          <div className="dialog-title">Invite a member</div>
          <IconButton name="x" onClick={onClose} />
        </div>
        <div className="dialog-body">
          <div className="field"><label className="field-label">Full name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jordan Lee" autoFocus /></div>
          <div className="field"><label className="field-label">Work email</label><input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" /></div>
          <div className="field"><label className="field-label">Role</label>
            <select className="select" value={role} onChange={(e) => setRole(e.target.value as 'admin' | 'agent' | 'requester')}>
              <option value="admin">Admin</option>
              <option value="agent">Agent</option>
              <option value="requester">Requester</option>
            </select>
          </div>
          <div style={{ fontSize: 'var(--t-caption)', color: 'var(--muted-foreground)', display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="mail" size={13} />They'll receive credentials to join the workspace.</div>
        </div>
        <div className="dialog-foot">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon="userPlus" onClick={submit}>Send invite</Button>
        </div>
      </div>
    </>
  );
}

/* ---------- Teams ---------- */
function TeamsSettings() {
  const { data: teams = [] } = useTeams();
  const { data: users = [] } = useUsers();
  const createTeamMut = useCreateTeam();
  const deleteTeamMut = useDeleteTeam();
  const [newName, setNewName] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const addTeam = () => {
    if (!newName.trim()) return;
    createTeamMut.mutate(newName.trim(), { onSuccess: () => setNewName('') });
  };

  return (
    <>
      <h1 className="set-h">Teams</h1>
      <p className="set-h-desc">Groups that tickets route to. Assign members and ticket types to control visibility.</p>

      <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
        <input className="input" placeholder="New team name…" value={newName} onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addTeam()} style={{ maxWidth: 280 }} />
        <Button variant="primary" size="sm" icon="plus" onClick={addTeam} disabled={!newName.trim()}>Add team</Button>
      </div>

      <div className="mem-list" style={{ marginTop: 16 }}>
        {teams.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 'var(--t-small)' }}>No teams yet. Create one above.</div>
        ) : teams.map((t) => (
          <div className="mem-row" key={t.id} style={{ gridTemplateColumns: '1fr auto auto auto', cursor: 'pointer', background: selectedId === t.id ? 'var(--muted)' : undefined }}
            onClick={() => setSelectedId(selectedId === t.id ? null : t.id)}>
            <div className="mem-person">
              <span className="avatar md" style={{ background: 'var(--muted-2)', color: 'var(--muted-foreground)' }}><Icon name="building" size={15} /></span>
              <div className="mem-name">{t.name}</div>
            </div>
            <div className="mem-last">{t.memberCount} member{t.memberCount === 1 ? '' : 's'}</div>
            <div className="mem-last">{t.schemaCount} type{t.schemaCount === 1 ? '' : 's'}</div>
            <IconButton name="x" title="Delete team" onClick={(e: MouseEvent) => { e.stopPropagation(); deleteTeamMut.mutate(t.id); if (selectedId === t.id) setSelectedId(null); }} />
          </div>
        ))}
      </div>

      {selectedId && <TeamDetail teamId={selectedId} users={users} />}
    </>
  );
}

function TeamDetail({ teamId, users }: { teamId: string; users: { id: string; name: string; email: string; role: string }[] }) {
  const { data: members = [] } = useTeamMembers(teamId);
  const addMember = useAddTeamMember(teamId);
  const removeMember = useRemoveTeamMember(teamId);
  const { data: assignedSchemas = [] } = useTeamSchemas(teamId);
  const addSchema = useAddTeamSchema(teamId);
  const removeSchema = useRemoveTeamSchema(teamId);
  const { data: allSchemas = [] } = useQuery({ queryKey: ['schemas'], queryFn: () => listSchemas() });

  const memberIds = new Set(members.map((m) => m.userId));
  const assignedSchemaIds = new Set(assignedSchemas.map((s) => s.schemaId));
  const availableUsers = users.filter((u) => !memberIds.has(u.id) && u.role !== 'requester');
  const ticketSchemas = allSchemas.filter((s) => s.kind === 'ticket');
  const availableSchemas = ticketSchemas.filter((s) => !assignedSchemaIds.has(s.id));

  const [addingMember, setAddingMember] = useState(false);
  const [addingSchema, setAddingSchema] = useState(false);

  return (
    <div className="team-detail">
      <div className="set-card">
        <div className="set-card-body">
          <div className="team-detail-section">
            <div className="team-detail-section-head">
              <div className="team-detail-section-title">Members</div>
              {!addingMember && availableUsers.length > 0 && (
                <Button variant="outline" size="sm" icon="userPlus" onClick={() => setAddingMember(true)}>Add member</Button>
              )}
            </div>
            {addingMember && (
              <div style={{ marginBottom: 8 }}>
                <select className="select" defaultValue="" onChange={(e) => { if (e.target.value) { addMember.mutate(e.target.value); setAddingMember(false); } }}>
                  <option value="" disabled>Select a user…</option>
                  {availableUsers.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
                </select>
              </div>
            )}
            <div className="mem-list">
              {members.length === 0 ? (
                <div style={{ padding: 16, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 'var(--t-small)' }}>No members assigned.</div>
              ) : members.map((m) => {
                const user = users.find((u) => u.id === m.userId);
                if (!user) return null;
                const initials = user.name.split(' ').map((p: string) => p[0]).slice(0, 2).join('').toUpperCase();
                return (
                  <div className="mem-row" key={m.userId} style={{ gridTemplateColumns: '1fr auto' }}>
                    <div className="mem-person">
                      <span className="avatar md" style={{ background: 'var(--primary)', color: '#fff' }}>{initials}</span>
                      <div style={{ minWidth: 0 }}>
                        <div className="mem-name">{user.name}</div>
                        <div className="mem-email">{user.email}</div>
                      </div>
                    </div>
                    <IconButton name="x" title="Remove member" onClick={() => removeMember.mutate(m.userId)} />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="team-detail-section" style={{ marginTop: 24 }}>
            <div className="team-detail-section-head">
              <div className="team-detail-section-title">Ticket types</div>
              {!addingSchema && availableSchemas.length > 0 && (
                <Button variant="outline" size="sm" icon="plus" onClick={() => setAddingSchema(true)}>Add type</Button>
              )}
            </div>
            {assignedSchemas.length === 0 && !addingSchema && (
              <div style={{ padding: 16, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 'var(--t-small)' }}>
                No restrictions — this team sees all ticket types.
              </div>
            )}
            {addingSchema && (
              <div style={{ marginBottom: 8 }}>
                <select className="select" defaultValue="" onChange={(e) => { if (e.target.value) { addSchema.mutate(e.target.value); setAddingSchema(false); } }}>
                  <option value="" disabled>Select a ticket type…</option>
                  {availableSchemas.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}
            {assignedSchemas.length > 0 && (
              <div className="mem-list">
                {assignedSchemas.map((as) => {
                  const schema = ticketSchemas.find((s) => s.id === as.schemaId);
                  return (
                    <div className="mem-row" key={as.schemaId} style={{ gridTemplateColumns: '1fr auto' }}>
                      <div className="mem-person">
                        <span className="avatar md" style={{ background: 'var(--muted-2)', color: 'var(--muted-foreground)' }}><Icon name="ticket" size={15} /></span>
                        <div className="mem-name">{schema?.name ?? as.schemaId}</div>
                      </div>
                      <IconButton name="x" title="Remove type" onClick={() => removeSchema.mutate(as.schemaId)} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- License ---------- */
function BillingSettings() {
  return (
    <>
      <h1 className="set-h">License</h1>
      <p className="set-h-desc">How Tessio is licensed and what it costs.</p>

      <div className="set-card">
        <div className="set-card-body" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ fontSize: 'var(--t-h2)', fontWeight: 600, marginBottom: 6 }}>Free &amp; self-hosted</div>
          <div style={{ color: 'var(--muted-foreground)', fontSize: 'var(--t-small)', maxWidth: 440, margin: '0 auto', lineHeight: 1.55 }}>
            Tessio is self-hosted and free under the{' '}
            <a href="https://www.elastic.co/licensing/elastic-license" target="_blank" rel="noreferrer">Elastic License 2.0</a>.
            Every feature is included — there are no paid tiers, seats, or invoices.
          </div>
        </div>
      </div>
    </>
  );
}
