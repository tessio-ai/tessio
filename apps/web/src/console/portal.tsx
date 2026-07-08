// SPDX-License-Identifier: AGPL-3.0-only

/* Requester portal — end-user submission on real /portal data. */
import { Fragment, useState, type CSSProperties, type ReactNode } from 'react';
import { Icon } from './icons';
import { Orb } from './agent';
import { useAuth } from '../auth/AuthContext';
import { detectCategory, DEFLECT, ROUTE } from './portal-assist';
import { usePublicPortalSettings, usePublicForms, usePublicForm, useMyTickets, useSubmitForm } from './portal/queries';
import { groupForms } from './portal/grouping';
import { PortalHero } from './portal/PortalHero';
import { PortalCatalogView } from './portal/PortalCatalogView';
import { PortalKnowledge } from './portal/PortalKnowledge';
import { PortalArticle } from './portal/PortalArticle';
import { RequestProgress } from './portal/RequestProgress';
import { statusLabel } from './portal/progress';
import type { ResolvedField } from '../api/portal';

function isEmpty(v: unknown): boolean {
  return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
}

type PortalView =
  | { kind: 'catalog' }
  | { kind: 'form'; key: string }
  | { kind: 'submitted'; key: string; ticketNumber: number | null }
  | { kind: 'mine' }
  | { kind: 'request'; id: string }
  | { kind: 'kb' }
  | { kind: 'article'; id: string };

function PortalField({ field, value, error, onChange }: { field: ResolvedField; value: unknown; error?: string; onChange: (k: string, v: unknown) => void }) {
  const id = `pf_${field.key}`;
  const errId = `${id}_err`;
  const helpId = `${id}_help`;
  const opts = field.options ?? [];
  const set = (v: unknown) => onChange(field.key, v);
  // Tie help + error text to the control for screen readers; flag invalid fields.
  const describedBy = [field.help ? helpId : null, error ? errId : null].filter(Boolean).join(' ') || undefined;
  const aria = { 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy };
  return (
    <div className="portal-field">
      <label className="portal-label" htmlFor={id}>{field.label}{field.required && <span className="req"> *</span>}</label>
      {field.type === 'text' && <input id={id} className="portal-input" placeholder={field.placeholder ?? ''} value={(value as string) ?? ''} onChange={(e) => set(e.target.value)} {...aria} />}
      {field.type === 'long-text' && <textarea id={id} className="portal-textarea" placeholder={field.placeholder ?? ''} value={(value as string) ?? ''} onChange={(e) => set(e.target.value)} {...aria} />}
      {field.type === 'number' && <input id={id} className="portal-input" type="number" placeholder={field.placeholder ?? ''} value={(value as string) ?? ''} onChange={(e) => set(e.target.value)} {...aria} />}
      {field.type === 'date' && <input id={id} className="portal-input" type="date" value={(value as string) ?? ''} onChange={(e) => set(e.target.value)} {...aria} />}
      {field.type === 'boolean' && (<label className="portal-bool"><input id={id} type="checkbox" checked={!!value} onChange={(e) => set(e.target.checked)} {...aria} /> Yes</label>)}
      {field.type === 'select' && (
        <select id={id} className="portal-select" value={(value as string) ?? ''} onChange={(e) => set(e.target.value)} {...aria}>
          <option value="" disabled>Select…</option>
          {opts.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      )}
      {field.type === 'multiselect' && (
        <div className="portal-choices" role="group" aria-label={field.label} {...aria}>
          {opts.map((o) => {
            const arr = (value as string[]) ?? [];
            const on = arr.includes(o);
            return <button type="button" key={o} role="checkbox" aria-checked={on} className={'portal-choice' + (on ? ' on' : '')} onClick={() => set(on ? arr.filter((x) => x !== o) : [...arr, o])}>
              <span className="pc-box" aria-hidden="true">{on && <Icon name="check" size={11} />}</span>{o}
            </button>;
          })}
        </div>
      )}
      {field.type === 'attachment' && (<div className="portal-file" aria-disabled="true"><Icon name="paperclip" size={18} /><span>Attachments coming soon</span></div>)}
      {field.help && <div className="portal-hint" id={helpId}>{field.help}</div>}
      {error && <div className="portal-err" id={errId}>{error}</div>}
    </div>
  );
}

function IntakeAssist({ category, accent }: { category: string; accent: string }) {
  const kb = DEFLECT[category];
  const route = ROUTE[category] || ROUTE.Other;
  return (
    <div className="intake-assist">
      <div className="intake-assist-head">
        <Orb size="sm" />
        <span className="ia-detected"><span className="ia-name">Tess</span> sees this is likely a <span className="ia-tag">{category}</span> issue — category set for you</span>
      </div>
      {kb && (
        <div className="deflect">
          <span className="df-ico"><Icon name="book" size={15} /></span>
          <div style={{ flex: 1, minWidth: 0 }}><div className="df-title">{kb.title}</div><div className="df-sub">{kb.read} read · solved {kb.solved} of similar issues instantly</div></div>
          <Icon name="arrowRight" size={16} style={{ color: '#9aa0aa' }} />
        </div>
      )}
      <div className="routing-note"><Icon name="zap" size={13} style={{ color: accent }} />Goes to <b>{route.team}</b> · typical first response <b>{route.sla}</b></div>
    </div>
  );
}

export function PublicIntakePage({ formKey, onSubmitted, onBack }: { formKey: string; onSubmitted: (n: number | null) => void; onBack: () => void }) {
  const { data: form, isLoading, isError } = usePublicForm(formKey);
  const submit = useSubmitForm();
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (isLoading) return <div className="portal"><div className="portal-inner muted" style={{ padding: 24 }}>Loading…</div></div>;
  if (isError || !form) return <div className="portal"><div className="portal-inner danger" style={{ padding: 24 }}>Couldn't load this form. <button className="ps-btn" onClick={onBack}>Back</button></div></div>;

  const th = form.theme;
  const set = (k: string, v: unknown) => {
    setValues((p) => ({ ...p, [k]: v }));
    setErrors((p) => { if (!p[k]) return p; const next = { ...p }; delete next[k]; return next; });
  };
  const fields = form.sections.flatMap((s) => s.fields);
  const watch = `${(values.title as string) ?? ''} ${(values.description as string) ?? ''} ${(values.summary as string) ?? ''}`;
  const detected = th.showTess ? detectCategory(watch) : null;
  const assistAfter = fields.some((f) => f.key === 'description') ? 'description' : fields.find((f) => f.type === 'long-text' || f.key === 'title')?.key;
  const cls = `portal ${th.layout === 'card' ? 'card' : ''} bg-${th.bg} font-${th.font}`;
  const style = { ['--pa']: th.accent } as CSSProperties;
  const serverErr = submit.error as { detail?: string } | null;
  const hasFieldErrors = Object.keys(errors).length > 0;

  async function onSubmit() {
    const missing = fields.filter((f) => f.required && isEmpty(values[f.key]));
    if (missing.length) {
      setErrors(Object.fromEntries(missing.map((f) => [f.key, `${f.label} is required.`])));
      // Move focus to the first invalid field so the error is heard and seen.
      requestAnimationFrame(() => document.getElementById(`pf_${missing[0].key}`)?.focus());
      return;
    }
    setErrors({});
    try {
      const t = await submit.mutateAsync({ key: formKey, values });
      onSubmitted(t.number);
    } catch { /* surfaced via submit.error */ }
  }

  return (
    <div className={cls} style={style}>
      <div className="portal-inner">
        <div className="portal-logo">{th.logo ? th.logo[0] : 'A'}</div>
        <div className="portal-h">{th.headline}</div>
        {th.intro && <div className="portal-intro">{th.intro}</div>}
        {form.sections.map((sec) =>
          sec.fields.map((f) => (
            <Fragment key={f.key}>
              <PortalField field={f} value={values[f.key]} error={errors[f.key]} onChange={set} />
              {detected && f.key === assistAfter && <IntakeAssist category={detected} accent={th.accent} />}
            </Fragment>
          )),
        )}
        {(hasFieldErrors || serverErr?.detail) && (
          <div className="portal-alert" role="alert">
            {serverErr?.detail ?? 'Please fix the highlighted fields above before submitting.'}
          </div>
        )}
        <button className="portal-submit" onClick={onSubmit} disabled={submit.isPending}>{submit.isPending ? 'Submitting…' : 'Submit request'}</button>
        <div className="portal-foot"><Icon name="lock" size={12} />Secured by Tessio</div>
      </div>
    </div>
  );
}


function CatalogState({ icon, title, children }: { icon: string; title: string; children?: ReactNode }) {
  return (
    <div className="rp-empty">
      <div className="rp-empty-ico"><Icon name={icon} size={26} /></div>
      <h3>{title}</h3>
      {children}
    </div>
  );
}

function CatalogSkeleton() {
  return (
    <div className="rp-cat-group" aria-hidden="true">
      <div className="rp-cat-head"><span className="skel" style={{ width: 150, height: 18, borderRadius: 6 }} /></div>
      <div className="rp-cat-grid">
        {[0, 1, 2, 3].map((i) => (
          <div className="rp-card rp-card-skel" key={i}>
            <span className="skel" style={{ width: 42, height: 42, borderRadius: 11, flex: 'none' }} />
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span className="skel" style={{ width: '55%', height: 14, borderRadius: 5 }} />
              <span className="skel" style={{ width: '90%', height: 12, borderRadius: 5 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RequesterCatalog({ onOpenForm }: { onOpenForm: (key: string) => void }) {
  const settingsQ = usePublicPortalSettings();
  const formsQ = usePublicForms();
  const settings = settingsQ.data;
  const published = formsQ.data ?? [];
  const { groups, orphans } = groupForms(published, settings?.categories ?? []);
  const isLoading = settingsQ.isLoading || formsQ.isLoading;
  const isError = settingsQ.isError || formsQ.isError;
  const hasContent = groups.length > 0 || orphans.length > 0;
  const retry = () => { void settingsQ.refetch(); void formsQ.refetch(); };

  return (
    <div className="rp-body">
      {settings && <PortalHero settings={settings} forms={published} onOpenForm={onOpenForm} />}
      {isLoading ? (
        <div className="rp-catalog"><CatalogSkeleton /></div>
      ) : isError ? (
        <div className="rp-catalog"><CatalogState icon="alert" title="Couldn't load requests"><p>Something went wrong loading the catalog. Your connection may have dropped.</p><button className="ps-btn rp-retry" onClick={retry}><Icon name="refresh" size={14} />Try again</button></CatalogState></div>
      ) : !hasContent ? (
        <div className="rp-catalog"><CatalogState icon="inbox" title="No request types yet"><p>There's nothing to request here just yet. Try searching above, or check back soon.</p></CatalogState></div>
      ) : settings ? (
        <PortalCatalogView catalog={settings.catalog} groups={groups} orphans={orphans} onOpenForm={onOpenForm} />
      ) : null}
    </div>
  );
}

function PortalHeader({ brandName, logo, userName, onHome, onMine, onKb, onSignOut, inForm }: {
  brandName: string; logo: string; userName: string; onHome: () => void; onMine: () => void; onKb?: () => void; onSignOut: () => void; inForm: boolean;
}) {
  const initials = userName.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase() || 'U';
  return (
    <header className="rp-header">
      {inForm ? (<button type="button" className="rp-back" onClick={onHome}><Icon name="arrowLeft" size={16} />All requests</button>)
        : (<div className="rp-brand"><div className="rp-logo">{logo ? logo[0] : 'A'}</div><div><div className="rp-brand-name">{brandName}</div><div className="rp-brand-sub">Get help, fast</div></div></div>)}
      <div className="rp-spacer" />
      {!inForm && (
        <nav className="rp-nav">
          <button type="button" className="rp-navitem on" aria-current="page" onClick={onHome}>Submit a request</button>
          <button type="button" className="rp-navitem" onClick={onMine}>My requests</button>
          {onKb && <button type="button" className="rp-navitem" onClick={onKb}>Help articles</button>}
        </nav>
      )}
      <button type="button" className="rp-exit" onClick={onSignOut} title="Sign out"><Icon name="logout" size={14} />Sign out</button>
      <span className="rp-uava" style={{ background: 'var(--primary)' }} aria-hidden="true">{initials}</span>
    </header>
  );
}

function Confirmation({ formKey, ticketNumber, onMine, onAnother }: { formKey: string; ticketNumber: number | null; onMine: () => void; onAnother: () => void }) {
  const { data: form } = usePublicForm(formKey);
  return (
    <div className="rp-body"><div className="portal"><div className="portal-inner">
      <div className="portal-success">
        <div className="ps-check"><Icon name="check" size={32} strokeWidth={2.4} /></div>
        <div className="ps-h">Request received</div>
        <div className="ps-sub">{form?.theme.success || 'Thanks — your request was received.'}</div>
        <div className="ps-ticket"><Icon name="ticket" size={15} />Request #{ticketNumber ?? '—'} created</div>
        <div className="ps-actions">
          <button className="ps-btn" onClick={onAnother}>Submit another request</button>
          <button className="ps-btn primary" onClick={onMine}>View my requests</button>
        </div>
      </div>
    </div></div></div>
  );
}

function MyRequests({ onOpen }: { onOpen: (id: string) => void }) {
  const { data: settings } = usePublicPortalSettings();
  const { data, isLoading, isError } = useMyTickets();
  const accent = { ['--pa']: settings?.accent ?? '#4f46e5' } as CSSProperties;
  if (isLoading) return <div className="rp-body"><p className="muted" style={{ padding: 24 }}>Loading…</p></div>;
  if (isError) return <div className="rp-body"><p className="danger" style={{ padding: 24 }}>Couldn't load your requests.</p></div>;
  const rows = data?.rows ?? [];
  if (!rows.length) return <div className="rp-body"><p className="muted" style={{ padding: 24 }}>You haven't submitted any requests yet.</p></div>;
  return (
    <div className="rp-body">
      <div className="rp-mine" style={accent}>
        <div className="rp-mine-head">
          <h2>Your requests</h2>
          <span className="rp-mine-count">{rows.length}</span>
        </div>
        {rows.map((t) => (
          <button type="button" className="rp-mine-row" key={t.id} onClick={() => onOpen(t.id)}>
            <span className="rm-ico" aria-hidden="true"><Icon name="ticket" size={17} /></span>
            <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
              <div className="rm-title">{(t.data.title as string) || `Request #${t.number}`}</div>
              <div className="rm-sub">#{t.number} · {new Date(t.createdAt).toLocaleDateString()}</div>
            </div>
            <span className="rp-status-chip" data-status={t.status ?? 'open'}>{statusLabel(t.status)}</span>
            <Icon name="chevronRight" size={16} style={{ color: 'var(--faint-foreground)' }} />
          </button>
        ))}
      </div>
    </div>
  );
}

export function RequesterPortal() {
  const { user, logout } = useAuth();
  const { data: settings } = usePublicPortalSettings();
  const [view, setView] = useState<PortalView>({ kind: 'catalog' });
  const userName = user?.name ?? '';

  return (
    <div className="reqportal">
      <PortalHeader
        brandName={settings?.brandName ?? 'Help Center'}
        logo={settings?.logo ?? ''}
        userName={userName}
        inForm={view.kind === 'form'}
        onHome={() => setView({ kind: 'catalog' })}
        onMine={() => setView({ kind: 'mine' })}
        onKb={() => setView({ kind: 'kb' })}
        onSignOut={() => { void logout(); }}
      />
      {view.kind === 'catalog' && <RequesterCatalog onOpenForm={(key) => setView({ kind: 'form', key })} />}
      {view.kind === 'form' && <div className="rp-body"><PublicIntakePage formKey={view.key} onBack={() => setView({ kind: 'catalog' })} onSubmitted={(n) => setView({ kind: 'submitted', key: view.key, ticketNumber: n })} /></div>}
      {view.kind === 'submitted' && <Confirmation formKey={view.key} ticketNumber={view.ticketNumber} onMine={() => setView({ kind: 'mine' })} onAnother={() => setView({ kind: 'catalog' })} />}
      {view.kind === 'mine' && <MyRequests onOpen={(id) => setView({ kind: 'request', id })} />}
      {view.kind === 'request' && <RequestProgress ticketId={view.id} onBack={() => setView({ kind: 'mine' })} onNewRequest={() => setView({ kind: 'catalog' })} />}
      {view.kind === 'kb' && <PortalKnowledge onOpen={(id) => setView({ kind: 'article', id })} onBack={() => setView({ kind: 'catalog' })} />}
      {view.kind === 'article' && <PortalArticle id={view.id} onBack={() => setView({ kind: 'kb' })} onOpenForm={(key) => setView({ kind: 'form', key })} />}
    </div>
  );
}
