// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useState, type MouseEvent, type CSSProperties } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '../icons';
import { Button, IconButton } from '../ui';
import { useAuth } from '../../auth/AuthContext';
import type { Route } from '../shell';
import { listSchemas } from '../../api/schemas';
import { listTeamMembers } from '../../api/team-members';
import { resetUserPassword, type ImportUserInput, type ImportUsersResult } from '../../api/users';
import { ApiError } from '../../api/types';
import { FREE_SEAT_LIMIT } from '@tessio/entitlements';
import {
  useOrg, useUpdateOrg,
  usePortalSettings, useUpdatePortalSettings,
  useLoginSettings, useUpdateLoginSettings,
  useUsers, useCreateUser, useUpdateUser, useImportUsers,
  useTeams, useCreateTeam, useUpdateTeam, useDeleteTeam,
  useTeamMembers, useAddTeamMember, useRemoveTeamMember,
  useTeamSchemas, useAddTeamSchema, useRemoveTeamSchema,
  useEntitlements,
} from './queries';
import { TessAiSettings } from './TessAiSettings';
import { useBot } from '../bot';
import { SecretsSettings } from './SecretsSettings';
import { EmailSettings } from './EmailSettings';
import { SlackSettings } from './SlackSettings';
import { NotificationSettings } from './NotificationSettings';
import { SlaSettings } from './SlaSettings';
import { CsatSettings } from './CsatSettings';
import { EeSsoSettings, EeAuditLog } from './ee-bridge';
import { EndpointAgentsSettings } from './EndpointAgentsSettings';

type Go = (screen: string, extra?: Partial<Route>) => void;

const SET_SECTIONS = [
  { group: 'Workspace', items: [
    { id: 'branding', label: 'Branding', icon: 'star' },
    { id: 'members', label: 'Members', icon: 'user' },
    { id: 'teams', label: 'Teams', icon: 'building' },
    { id: 'tess', label: 'Tess AI', icon: 'sparkles' }, // label personalized at render via useBot()
    { id: 'email', label: 'Email', icon: 'mail' },
    { id: 'slack', label: 'Slack', icon: 'send' },
    { id: 'sla', label: 'SLA', icon: 'clock' },
    { id: 'csat', label: 'Satisfaction', icon: 'star' },
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

  // Enterprise features are gated by edition entitlements.
  const { data: ent } = useEntitlements();
  const bot = useBot();
  const ssoOn = !!ent?.features.sso;
  const auditOn = !!ent?.features.audit_log;

  // Hide enterprise nav items unless entitled; the AI item shows the org's assistant name.
  const sections = SET_SECTIONS.map((g) => ({
    ...g,
    items: g.items
      .filter((it) => (it.id === 'sso' ? ssoOn : it.id === 'audit' ? auditOn : true))
      .map((it) => (it.id === 'tess' ? { ...it, label: `${bot.name} AI` } : it)),
  }));

  let body;
  if (section === 'branding') body = <BrandingSettings />;
  else if (section === 'members') body = <MembersSettings />;
  else if (section === 'teams') body = <TeamsSettings />;
  else if (section === 'tess') body = <TessAiSettings />;
  else if (section === 'email') body = <EmailSettings />;
  else if (section === 'slack') body = <SlackSettings />;
  else if (section === 'sla') body = <SlaSettings />;
  else if (section === 'csat') body = <CsatSettings />;
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

      <SignInBrandingCard />
    </>
  );
}

/* ---------- Sign-in page branding ---------- */
interface SignInDraft { brandName: string; logo: string; headline: string; tagline: string }

/** Read an uploaded image and downscale it so the stored data URL stays small. */
async function fileToLogoDataUrl(file: File): Promise<string> {
  const raw = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ''));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('not an image'));
    i.src = raw;
  });
  const MAX = 256;
  if (img.width <= MAX && img.height <= MAX && raw.length <= 200_000) return raw;
  const scale = Math.min(MAX / img.width, MAX / img.height, 1);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}

function SignInBrandingCard() {
  const { data: settings } = useLoginSettings();
  const { data: portal } = usePortalSettings();
  const update = useUpdateLoginSettings();
  const [draft, setDraft] = useState<SignInDraft | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);

  useEffect(() => {
    if (settings && !draft) {
      setDraft({
        brandName: settings.brandName,
        logo: settings.logo ?? '',
        headline: settings.headline,
        tagline: settings.tagline,
      });
    }
  }, [settings]);

  if (!settings || !draft) return null;

  const set = <K extends keyof SignInDraft>(k: K, v: SignInDraft[K]) => setDraft((d) => d && ({ ...d, [k]: v }));

  const dirty = draft.brandName !== settings.brandName
    || draft.logo !== (settings.logo ?? '')
    || draft.headline !== settings.headline
    || draft.tagline !== settings.tagline;

  const save = () => {
    const patch: Record<string, string> = {};
    if (draft.brandName !== settings.brandName) patch.brandName = draft.brandName;
    if (draft.logo !== (settings.logo ?? '')) patch.logo = draft.logo;
    if (draft.headline !== settings.headline) patch.headline = draft.headline;
    if (draft.tagline !== settings.tagline) patch.tagline = draft.tagline;
    if (Object.keys(patch).length) update.mutate(patch);
  };

  const onLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setLogoError(null);
    fileToLogoDataUrl(file)
      .then((dataUrl) => set('logo', dataUrl))
      .catch(() => setLogoError('That file could not be read as an image.'));
  };

  return (
    <div className="set-card">
      <div className="set-card-head">
        <div className="set-card-title">Sign-in page</div>
        <div className="set-card-sub">The screen everyone sees before they log in — add your logo and make it yours.</div>
      </div>
      <div className="set-card-body">
        <div className="set-row">
          <div><div className="sr-label">Logo</div><div className="sr-hint">Shown top-left and above the headline. PNG or SVG with a transparent background looks best.</div></div>
          <div className="slb-logo-controls">
            <div className="slb-logo-preview">
              {draft.logo ? <img src={draft.logo} alt="Sign-in logo" /> : <Icon name="zap" size={20} />}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer' }}>
                <Icon name="paperclip" size={14} /> Upload image
                <input type="file" accept="image/*" onChange={onLogoFile} style={{ display: 'none' }} />
              </label>
              {draft.logo && <Button variant="ghost" size="sm" icon="x" onClick={() => set('logo', '')}>Remove</Button>}
            </div>
            {logoError && <div className="danger">{logoError}</div>}
          </div>
        </div>

        <div className="set-row">
          <div><div className="sr-label">Workspace name</div><div className="sr-hint">Appears next to the logo in the top corner.</div></div>
          <input className="input" value={draft.brandName} onChange={(e) => set('brandName', e.target.value)} placeholder="Tessio" style={{ maxWidth: 320 }} />
        </div>

        <div className="set-row">
          <div><div className="sr-label">Headline &amp; tagline</div><div className="sr-hint">The welcome copy on the sign-in card.</div></div>
          <div>
            <input className="input" value={draft.headline} onChange={(e) => set('headline', e.target.value)} placeholder="Welcome back" style={{ maxWidth: 320 }} />
            <input className="input" value={draft.tagline} onChange={(e) => set('tagline', e.target.value)} placeholder="Sign in to your workspace to pick up where you left off." style={{ maxWidth: 320, marginTop: 8 }} />
          </div>
        </div>

        <div className="set-row">
          <div><div className="sr-label">Preview</div><div className="sr-hint">How the sign-in card will look.</div></div>
          <div className="slb-preview" style={{ '--login-accent': portal?.accent ?? '#4f46e5' } as CSSProperties}>
            <div className="slb-preview-topbar">
              {draft.logo
                ? <img className="slb-mark" src={draft.logo} alt="" />
                : <span className="slb-mark slb-mark-default"><Icon name="zap" size={11} /></span>}
              <span>{draft.brandName || 'Tessio'}</span>
            </div>
            <div className="slb-preview-card">
              <div className="slb-badge">
                {draft.logo ? <img src={draft.logo} alt="" /> : <Icon name="logIn" size={16} />}
              </div>
              <div className="slb-headline">{draft.headline || 'Welcome back'}</div>
              <div className="slb-tagline">{draft.tagline || 'Sign in to your workspace to pick up where you left off.'}</div>
              <div className="slb-input">Email</div>
              <div className="slb-input">Password</div>
              <div className="slb-btn">Sign in</div>
            </div>
          </div>
        </div>
      </div>
      <div className="set-card-foot">
        <Button variant="primary" size="sm" onClick={save} disabled={!dirty || update.isPending}>
          {update.isPending ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
        </Button>
      </div>
    </div>
  );
}

/* ---------- Members ---------- */

/** Human-readable message for a failed member mutation; seat-limit 402s carry a full explanation. */
function memberErrorText(err: unknown): string {
  // ApiError's message is already `detail ?? title` (see api/types.ts).
  return err instanceof ApiError ? err.message : 'Something went wrong — please try again.';
}

function MembersSettings() {
  const { user: me } = useAuth();
  const { data: users = [] } = useUsers();
  const { data: teams = [] } = useTeams();
  const { data: ent } = useEntitlements();
  const createUserMut = useCreateUser();
  const updateUserMut = useUpdateUser();
  const [tab, setTab] = useState('all');
  const [q, setQ] = useState('');
  const [inviting, setInviting] = useState(false);
  const [importingUsers, setImportingUsers] = useState(false);
  const [resettingUser, setResettingUser] = useState<{ id: string; name: string; email: string } | null>(null);

  const seatLimit = ent?.seatLimit;
  const seatsUsed = ent?.seatsUsed;
  const atSeatLimit = seatLimit != null && seatsUsed != null && seatsUsed >= seatLimit;

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
        <div>
          <h1 className="set-h">Members</h1>
          <p className="set-h-desc">
            {agents.length} agents · {requesters.length} requesters
            {seatLimit != null && seatsUsed != null && <> · {seatsUsed} of {seatLimit} seats used</>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="outline" icon="inbox" onClick={() => setImportingUsers(true)}>Import</Button>
          <Button variant="primary" icon="userPlus" onClick={() => setInviting(true)}>Invite member</Button>
        </div>
      </div>

      {atSeatLimit && (
        <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--muted-2)', fontSize: 'var(--t-caption)', color: 'var(--muted-foreground)' }}>
          All {seatLimit} admin/agent seats are in use. Requesters are free and unlimited; to add another admin or agent,
          add seats to your subscription or disable an existing admin/agent first.
        </div>
      )}
      {updateUserMut.isError && (
        <div style={{ marginTop: 10, fontSize: 'var(--t-caption)', color: 'var(--danger)' }}>
          {memberErrorText(updateUserMut.error)}
        </div>
      )}

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
              <div style={{ display: 'flex', gap: 2 }}>
                {!isMe && (
                  <>
                    <IconButton name="refresh" title="Reset password"
                      onClick={() => setResettingUser({ id: u.id, name: u.name, email: u.email })} />
                    <IconButton name={u.status === 'active' ? 'lock' : 'check'} title="Toggle status"
                      onClick={() => updateUserMut.mutate({ id: u.id, status: u.status === 'active' ? 'disabled' : 'active' })} />
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {inviting && <InviteDialog
        teams={teams.map((t) => t.name)}
        onClose={() => { createUserMut.reset(); setInviting(false); }}
        pending={createUserMut.isPending}
        error={createUserMut.isError ? memberErrorText(createUserMut.error) : null}
        onAdd={(body) => {
          createUserMut.mutate(body, { onSuccess: () => setInviting(false) });
        }} />}

      {importingUsers && <ImportUsersDialog onClose={() => setImportingUsers(false)} />}

      {resettingUser && <ResetPasswordDialog user={resettingUser} onClose={() => setResettingUser(null)} />}
    </>
  );
}

/** Admin resets a member's password; the generated password is shown exactly once. */
function ResetPasswordDialog({ user, onClose }: { user: { id: string; name: string; email: string }; onClose: () => void }) {
  const [password, setPassword] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const doReset = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await resetUserPassword(user.id);
      setPassword(r.password);
    } catch (err) {
      setError(memberErrorText(err));
    } finally {
      setBusy(false);
    }
  };
  const copy = () => {
    void navigator.clipboard?.writeText(password ?? '');
    setCopied(true);
  };

  return (
    <>
      <div className="scrim" style={{ zIndex: 60 }} onClick={onClose} />
      <div className="dialog" role="dialog" aria-label="Reset password">
        <div className="dialog-head">
          <div className="dialog-title">Reset password</div>
          <IconButton name="x" onClick={onClose} />
        </div>
        <div className="dialog-body">
          {!password ? (
            <>
              <div style={{ fontSize: 'var(--t-small)', lineHeight: 1.5 }}>
                Generate a new password for <strong>{user.name}</strong> ({user.email})?
                Their current password stops working and they are signed out everywhere.
              </div>
              {error && <div style={{ marginTop: 10, fontSize: 'var(--t-caption)', color: 'var(--danger)' }}>{error}</div>}
            </>
          ) : (
            <>
              <div style={{ fontSize: 'var(--t-caption)', color: 'var(--muted-foreground)', marginBottom: 8 }}>
                Share this password with {user.name} now — it is shown only once.
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <code style={{ flex: 1, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', fontFamily: 'var(--font-mono, monospace)', fontSize: 'var(--t-small)', userSelect: 'all' }}>{password}</code>
                <Button variant="outline" size="sm" icon={copied ? 'checkCheck' : 'copy'} onClick={copy}>{copied ? 'Copied' : 'Copy'}</Button>
              </div>
            </>
          )}
        </div>
        <div className="dialog-foot">
          {!password ? (
            <>
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button variant="primary" icon="refresh" onClick={doReset} disabled={busy}>{busy ? 'Resetting…' : 'Reset password'}</Button>
            </>
          ) : (
            <Button variant="primary" onClick={onClose}>Done</Button>
          )}
        </div>
      </div>
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

function InviteDialog({ onClose, onAdd, pending, error }: {
  teams: string[];
  onClose: () => void;
  onAdd: (b: { name: string; email: string; role: 'admin' | 'agent' | 'requester'; password: string }) => void;
  pending?: boolean;
  error?: string | null;
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
          {error && <div style={{ marginTop: 10, fontSize: 'var(--t-caption)', color: 'var(--danger)' }}>{error}</div>}
        </div>
        <div className="dialog-foot">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon="userPlus" onClick={submit} disabled={pending}>{pending ? 'Inviting…' : 'Send invite'}</Button>
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
  const selectedTeam = teams.find((t) => t.id === selectedId) ?? null;

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
              <div style={{ minWidth: 0 }}>
                <div className="mem-name">{t.name}</div>
                {t.emailAddress && <div className="mem-email">{t.emailAddress}</div>}
              </div>
            </div>
            <div className="mem-last">{t.memberCount} member{t.memberCount === 1 ? '' : 's'}</div>
            <div className="mem-last">{t.schemaCount} type{t.schemaCount === 1 ? '' : 's'}</div>
            <IconButton name="x" title="Delete team" onClick={(e: MouseEvent) => { e.stopPropagation(); deleteTeamMut.mutate(t.id); if (selectedId === t.id) setSelectedId(null); }} />
          </div>
        ))}
      </div>

      {selectedTeam && <TeamDetail key={selectedTeam.id} team={selectedTeam} users={users} />}
    </>
  );
}

function TeamDetail({ team, users }: { team: { id: string; name: string; emailAddress: string | null; emailName: string | null }; users: { id: string; name: string; email: string; role: string }[] }) {
  const teamId = team.id;
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

  const updateTeamMut = useUpdateTeam();
  const [emailAddress, setEmailAddress] = useState(team.emailAddress ?? '');
  const [emailName, setEmailName] = useState(team.emailName ?? '');
  const emailDirty = emailAddress.trim() !== (team.emailAddress ?? '') || emailName.trim() !== (team.emailName ?? '');
  const saveEmail = () => updateTeamMut.mutate({
    id: teamId,
    patch: { emailAddress: emailAddress.trim().toLowerCase() || null, emailName: emailName.trim() || null },
  });

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

          <div className="team-detail-section" style={{ marginTop: 24 }}>
            <div className="team-detail-section-head">
              <div className="team-detail-section-title">Email</div>
            </div>
            <div className="set-row">
              <div><div className="sr-label">Team email address</div><div className="sr-hint">Outgoing mail for this team's tickets is sent from this address, and new mail sent to it routes here. Leave blank to use the workspace default.</div></div>
              <input className="input" value={emailAddress} placeholder="hr@example.com" onChange={(e) => setEmailAddress(e.target.value)} style={{ maxWidth: 320 }} type="email" />
            </div>
            <div className="set-row">
              <div><div className="sr-label">From name</div><div className="sr-hint">Display name for outgoing mail (e.g. "HR Desk").</div></div>
              <input className="input" value={emailName} placeholder="HR Desk" onChange={(e) => setEmailName(e.target.value)} style={{ maxWidth: 320 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <Button variant="primary" size="sm" onClick={saveEmail} disabled={!emailDirty || updateTeamMut.isPending}>
                {updateTeamMut.isPending ? 'Saving…' : 'Save email settings'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- License ---------- */
function BillingSettings() {
  const { data: ent } = useEntitlements();
  const edition = ent?.edition ?? 'community';
  const isPaid = edition === 'enterprise' || edition === 'cloud';
  const editionLabel = edition === 'cloud' ? 'Cloud' : edition === 'enterprise' ? 'Enterprise' : 'Community';
  const seatLimit = ent?.seatLimit;
  const seatsUsed = ent?.seatsUsed;

  return (
    <>
      <h1 className="set-h">License</h1>
      <p className="set-h-desc">How Tessio is licensed.</p>

      <div className="set-card">
        <div className="set-card-body" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ fontSize: 'var(--t-h2)', fontWeight: 600, marginBottom: 6 }}>
            {editionLabel} edition
          </div>
          {seatsUsed != null && (
            <div style={{ fontSize: 'var(--t-small)', marginBottom: 12 }}>
              <strong>{seatsUsed}</strong> of <strong>{seatLimit ?? 'unlimited'}</strong> admin/agent seats in use
              {seatLimit != null && seatsUsed >= seatLimit && <span style={{ color: 'var(--muted-foreground)' }}> — all seats taken</span>}
            </div>
          )}
          <div style={{ color: 'var(--muted-foreground)', fontSize: 'var(--t-small)', maxWidth: 460, margin: '0 auto', lineHeight: 1.55 }}>
            Tessio is <strong>open core</strong>. The self-hostable core product is free and open source under the{' '}
            <a href="https://www.gnu.org/licenses/agpl-3.0.html" target="_blank" rel="noreferrer">GNU AGPL-3.0</a>,
            and is <strong>free for up to {FREE_SEAT_LIMIT} admins and agents</strong>.
            Requesters are always free and unlimited.
            {isPaid ? (
              <> This instance runs under a commercial per-seat license, which also enables enterprise features (SSO, audit log).</>
            ) : (
              <> Beyond that, a commercial per-seat subscription adds seats month-to-month and enables enterprise add-ons (SSO, audit log).</>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
