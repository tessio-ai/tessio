// SPDX-License-Identifier: AGPL-3.0-only

/* Ticket detail — timeline + composer + properties rail. Ported from the design handoff. */
import { useState, useRef, useEffect, type ReactNode } from 'react';
import { Icon } from './icons';
import { Avatar, AvatarName, StatusPill, PriorityTag, TypeBadge, Button, IconButton, Kbd, Popover, relTime, absTime, dueInfo } from './ui';
import { Orb, AgentSummary, AiDraftCard, AiInsights } from './agent';
import { useBot } from './bot';
import { STATUS_MAP, PRIORITY_MAP, TYPE_MAP } from './data';
import type { Route } from './shell';
import { useTicket, useTickets, useUsers, useTicketSchemas, useTicketComments, useAddComment, useUpdateTicket, useTicketLinks, useAddTicketLink, useDeleteTicketLink, useTeams, useTicketActivity, useTicketAttachments, useUploadAttachment, useDeleteAttachment, useTicketSubtasks, useCreateSubtask } from './tickets/queries';
import { useAssets } from './assets/queries';
import { downloadAttachment } from '../api/attachments';
import { toDisplayTicket, usersById } from './tickets/adapt';
import { ticketTypeKeyById } from './tickets/types-map';
import { useTicketTriage, useSimilarTickets, useTicketCsat } from './tickets/queries';
import { useAiSettings } from './settings/queries';
import { streamTicketSummary, streamTicketDraft } from '../api/ai';

type Go = (screen: string, extra?: Partial<Route>) => void;

const TL_ICON: Record<string, string> = { created: 'plus', assigned: 'user', status: 'refresh', priority: 'alert', comment: 'message', team: 'building', field_changed: 'edit', csat_submitted: 'star', parent: 'gitBranch' };

function PropRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="prop-row">
      <div className="prop-label">{label}</div>
      <div className="prop-val">{children}</div>
    </div>
  );
}
function EditableProp({ children }: { children: ReactNode }) {
  return (
    <span className="prop-edit">
      {children}
      <Icon name="chevronDown" size={13} />
    </span>
  );
}
function PropSelect({ value, options, onChange }: { value: string; options: { value: string; label: string; dot?: string }[]; onChange: (v: string) => void }) {
  const selected = options.find((o) => o.value === value);
  return (
    <Popover
      align="left"
      width={180}
      trigger={
        <span className="prop-edit">
          {selected?.dot && <span style={{ width: 8, height: 8, borderRadius: '50%', background: selected.dot, flexShrink: 0 }} />}
          {selected?.label ?? value}
          <Icon name="chevronDown" size={13} />
        </span>
      }
    >
      {(close: () => void) => (
        <div className="menu">
          {options.map((o) => (
            <div key={o.value} className="menu-item" onClick={() => { onChange(o.value); close(); }}>
              {o.dot && <span style={{ width: 8, height: 8, borderRadius: '50%', background: o.dot, flexShrink: 0 }} />}
              {o.label}
              {o.value === value && <span style={{ marginLeft: 'auto', color: 'var(--primary)' }}><Icon name="check" size={14} /></span>}
            </div>
          ))}
        </div>
      )}
    </Popover>
  );
}

const RELATIONSHIP_TYPES = ['related to', 'blocked by', 'blocks', 'duplicated by', 'duplicates', 'caused by'];

function LinkDialog({ ticketId, onClose, onLinked }: { ticketId: string; onClose: () => void; onLinked: () => void }) {
  const [search, setSearch] = useState('');
  const [relType, setRelType] = useState('related to');
  const addLink = useAddTicketLink(ticketId);
  const ticketsQ = useTickets({ limit: 50 });
  const assetsQ = useAssets({ limit: 50 });

  const q = search.toLowerCase();
  const ticketResults = (ticketsQ.data?.rows ?? [])
    .filter((t) => t.id !== ticketId)
    .filter((t) => !q || `#${t.number} ${(t.data as Record<string, unknown>).title ?? ''}`.toLowerCase().includes(q))
    .slice(0, 5);
  const assetResults = (assetsQ.data?.rows ?? [])
    .filter((a) => !q || `${a.assetTag ?? ''} ${(a.data as Record<string, unknown>).name ?? ''}`.toLowerCase().includes(q))
    .slice(0, 5);

  const handleLink = (toType: 'ticket' | 'asset', toId: string) => {
    addLink.mutate({ toType, toId, relationshipType: relType }, { onSuccess: () => { onLinked(); onClose(); } });
  };

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="dialog" role="dialog" aria-modal="true" aria-label="Link a record" style={{ width: 480, maxHeight: '70vh', display: 'flex', flexDirection: 'column' }}>
        <h3 className="dialog-title">Link a record</h3>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <PropSelect value={relType} options={RELATIONSHIP_TYPES.map((r) => ({ value: r, label: r }))} onChange={setRelType} />
        </div>
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <Icon name="search" size={15} />
          <input
            autoFocus
            placeholder="Search tickets and assets…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', padding: '8px 8px 8px 4px', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', background: 'var(--surface)', color: 'var(--foreground)', font: 'inherit', fontSize: 'var(--t-small)', outline: 'none' }}
          />
        </div>
        <div style={{ overflow: 'auto', flex: 1 }}>
          {ticketResults.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--faint-foreground)', padding: '8px 0 4px' }}>Tickets</div>
              {ticketResults.map((t) => (
                <div key={t.id} className="menu-item" onClick={() => handleLink('ticket', t.id)} style={{ cursor: addLink.isPending ? 'wait' : 'pointer' }}>
                  <Icon name="ticket" size={15} />
                  <span>#{t.number}</span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(t.data as Record<string, unknown>).title as string ?? ''}</span>
                </div>
              ))}
            </>
          )}
          {assetResults.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--faint-foreground)', padding: '8px 0 4px' }}>Assets</div>
              {assetResults.map((a) => (
                <div key={a.id} className="menu-item" onClick={() => handleLink('asset', a.id)} style={{ cursor: addLink.isPending ? 'wait' : 'pointer' }}>
                  <Icon name="box" size={15} />
                  <span>{a.assetTag ?? a.id.slice(0, 8)}</span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(a.data as Record<string, unknown>).name as string ?? ''}</span>
                </div>
              ))}
            </>
          )}
          {ticketResults.length === 0 && assetResults.length === 0 && (
            <div className="muted" style={{ padding: 16, textAlign: 'center' }}>No results found.</div>
          )}
        </div>
        <div className="dialog-actions">
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </>
  );
}

export function TicketDetail({ ticketId, go, addToast }: { ticketId: string; go: Go; addToast: (msg: string, link?: string) => void }) {
  const [tab, setTab] = useState('activity');
  const [internal, setInternal] = useState(false);
  const [comment, setComment] = useState('');
  const [showDraft, setShowDraft] = useState(true);
  const [linkOpen, setLinkOpen] = useState(false);
  const [editingDetails, setEditingDetails] = useState(false);
  const [newSubtask, setNewSubtask] = useState('');
  const [aiSummary, setAiSummary] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [aiDraft, setAiDraft] = useState('');
  const [draftLoading, setDraftLoading] = useState(false);
  const summaryAbortRef = useRef<AbortController | null>(null);
  const draftAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setAiSummary(''); setAiDraft(''); setSummaryLoading(false); setDraftLoading(false);
    return () => {
      summaryAbortRef.current?.abort();
      draftAbortRef.current?.abort();
    };
  }, [ticketId]);

  const ticketQ = useTicket(ticketId);
  const usersQ = useUsers();
  const teamsQ = useTeams();
  const schemasQ = useTicketSchemas();
  const commentsQ = useTicketComments(ticketId);
  const activityQ = useTicketActivity(ticketId);
  const linksQ = useTicketLinks(ticketId);
  const subtasksQ = useTicketSubtasks(ticketId);
  const createSubtask = useCreateSubtask(ticketId);
  const allTicketsQ = useTickets({ limit: 200 });
  const attachmentsQ = useTicketAttachments(ticketId);
  const upload = useUploadAttachment(ticketId);
  const delAtt = useDeleteAttachment(ticketId);
  const update = useUpdateTicket(ticketId);
  const addComment = useAddComment(ticketId);
  const removeLink = useDeleteTicketLink(ticketId);
  const aiSettingsData = useAiSettings().data;
  const triageData = useTicketTriage(ticketId).data ?? null;
  const similarEnabled = !!aiSettingsData?.enabled && !!aiSettingsData.features.similar;
  const similarQ = useSimilarTickets(ticketId, similarEnabled);
  const csatSurvey = useTicketCsat(ticketId).data?.survey ?? null;

  if (ticketQ.isLoading || !ticketQ.data) return <div className="detail"><div className="page-pad muted">Loading…</div></div>;

  const umap = usersById(usersQ.data ?? []);
  const teamsById = Object.fromEntries((teamsQ.data ?? []).map((t) => [t.id, t]));
  const schema = (schemasQ.data ?? []).find((s) => s.id === ticketQ.data!.schemaId);
  const ticket = toDisplayTicket(ticketQ.data!, ticketTypeKeyById(schemasQ.data ?? []));

  function timelineLine(ev: any): ReactNode {
    const who = umap[ev.who] ?? { name: 'Someone', initials: '?', color: 'var(--muted)', id: '', role: '' };
    switch (ev.kind) {
      case 'created':
        return <><b>{who.name}</b> created the ticket</>;
      case 'assigned':
        return <><b>{who.name}</b> assigned to <b>{(umap[ev.to] ?? { name: 'Someone' }).name}</b></>;
      case 'status':
        return <><b>{who.name}</b> changed status <b>{STATUS_MAP[ev.from]?.label || ev.from}</b> → <b>{STATUS_MAP[ev.to]?.label || ev.to}</b></>;
      case 'priority':
        return <><b>{who.name}</b> set priority <b>{PRIORITY_MAP[ev.from]?.label ?? ev.from}</b> → <b>{PRIORITY_MAP[ev.to]?.label ?? ev.to}</b></>;
      case 'team':
        return <><b>{who.name}</b> {ev.to ? <>routed to <b>{teamsById[ev.to]?.name ?? 'a team'}</b></> : <>cleared the team</>}</>;
      case 'parent': {
        const parent = ev.to ? (allTicketsQ.data?.rows ?? []).find((t) => t.id === ev.to) : null;
        return <><b>{who.name}</b> {ev.to ? <>made this a subtask of <b>{parent ? `#${parent.number}` : 'another ticket'}</b></> : <>detached this from its parent</>}</>;
      }
      case 'field_changed': {
        const fieldLabel = (schema?.definition.fields ?? []).find((f) => f.key === ev.field)?.label ?? ev.field ?? 'a field';
        return <><b>{who.name}</b> updated <b>{fieldLabel}</b>{ev.from && ev.to ? <> from <b>{String(ev.from)}</b> → <b>{String(ev.to)}</b></> : ev.to ? <> to <b>{String(ev.to)}</b></> : <> (cleared)</>}</>;
      }
      case 'csat_submitted':
        return <><b>{who.name}</b> rated this ticket <b>{ev.rating != null ? `${ev.rating}/5` : ''}</b></>;
      default:
        return <><b>{who.name}</b> commented</>;
    }
  }

  function TimelineItem({ ev }: { ev: any }) {
    const bot = useBot();
    const who = umap[ev.who] ?? { name: 'Someone', initials: '?', color: 'var(--muted)', id: '', role: '' };
    if (ev.kind === 'agent') {
      return (
        <div className="tl-item">
          <span className="tl-ico agent" style={{ display: 'grid', placeItems: 'center' }}><Orb size="sm" /></span>
          <div className="tl-body" style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 5, flexWrap: 'wrap' }}>
            <span className="tl-line"><b className="ai-text">{bot.name}</b> {ev.body}</span>
            <span className="ai-chip"><Icon name="sparkles" size={10} />auto</span>
            <span className="tl-time" title={absTime(ev.at)}>· {relTime(ev.at)}</span>
          </div>
        </div>
      );
    }
    if (ev.kind === 'comment') {
      return (
        <div className="tl-item">
          <Avatar user={who} size="md" />
          <div className="tl-body">
            <div className={'comment' + (ev.internal ? ' internal' : '')}>
              <div className="comment-head">
                <span className="comment-author">{who.name}</span>
                {ev.internal ? (
                  <span className="pill pill-warning" style={{ height: 18 }}><Icon name="lock" size={10} />Internal note</span>
                ) : (
                  <span className="badge" style={{ height: 18 }}>Public</span>
                )}
                <span className="tl-time" style={{ marginLeft: 'auto' }} title={absTime(ev.at)}>{relTime(ev.at)}</span>
              </div>
              {ev.body}
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="tl-item">
        <div className="tl-ico"><Icon name={TL_ICON[ev.kind] || 'activity'} size={14} /></div>
        <div className="tl-body" style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 5 }}>
          <span className="tl-line">{timelineLine(ev)}</span>
          <span className="tl-time" title={absTime(ev.at)}>· {relTime(ev.at)}</span>
        </div>
      </div>
    );
  }

  const summaryEnabled = !!aiSettingsData?.enabled && !!aiSettingsData.features.summary;
  const draftEnabled = !!aiSettingsData?.enabled && !!aiSettingsData.features.draft;

  const runSummary = () => {
    summaryAbortRef.current?.abort();
    const ctrl = new AbortController();
    summaryAbortRef.current = ctrl;
    setAiSummary('');
    setSummaryLoading(true);
    streamTicketSummary(ticket.id, (chunk) => setAiSummary((s) => s + chunk), ctrl.signal)
      .catch((e) => { if ((e as Error)?.name !== 'AbortError') setAiSummary('Could not generate a summary.'); })
      .finally(() => { if (summaryAbortRef.current === ctrl) setSummaryLoading(false); });
  };
  const runDraft = () => {
    draftAbortRef.current?.abort();
    const ctrl = new AbortController();
    draftAbortRef.current = ctrl;
    setAiDraft('');
    setDraftLoading(true);
    streamTicketDraft(ticket.id, (chunk) => setAiDraft((s) => s + chunk), ctrl.signal)
      .catch((e) => { if ((e as Error)?.name !== 'AbortError') setAiDraft('Could not generate a draft.'); })
      .finally(() => { if (draftAbortRef.current === ctrl) setDraftLoading(false); });
  };

  const events: any[] = [
    ...(activityQ.data ?? []).map((a) => ({ kind: a.eventType, who: a.actorId, at: Date.parse(a.createdAt), from: a.changes?.from, to: a.changes?.to, field: a.changes?.field, rating: a.changes?.rating })),
    ...(commentsQ.data ?? []).map((c) => ({ kind: 'comment', who: c.authorId, at: Date.parse(c.createdAt), internal: c.internal, body: c.body })),
  ].sort((a, b) => a.at - b.at);

  const due = dueInfo(ticket.dueAt);
  const req = ticket.requesterId ? umap[ticket.requesterId] : null;

  const submitComment = () => {
    if (!comment.trim()) return;
    addComment.mutate({ body: comment.trim(), internal }, { onSuccess: () => { setComment(''); addToast(internal ? 'Internal note added' : 'Comment posted'); } });
  };

  const fmtSize = (n: number) => n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(1) + ' MB';

  const TABS = [
    { id: 'activity', label: 'Activity', icon: 'activity' },
    { id: 'details', label: 'Details', icon: 'form' },
    { id: 'subtasks', label: 'Subtasks', icon: 'gitBranch' },
    { id: 'linked', label: 'Linked', icon: 'link' },
    { id: 'files', label: 'Files', icon: 'paperclip' },
  ];

  const subtasks = subtasksQ.data ?? [];
  const subtasksDone = subtasks.filter((s) => ['resolved', 'closed'].includes(s.status ?? '')).length;

  const addSubtask = () => {
    const title = newSubtask.trim();
    if (!title || createSubtask.isPending) return;
    createSubtask.mutate(
      { schemaId: ticketQ.data!.schemaId, schemaVersion: ticketQ.data!.schemaVersion, status: 'open', data: { title } },
      { onSuccess: () => { setNewSubtask(''); addToast('Subtask created'); } },
    );
  };

  const parentTicket = ticket.parentId ? (allTicketsQ.data?.rows ?? []).find((t) => t.id === ticket.parentId) : null;

  return (
    <div className="detail">
      <div className="detail-main" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="dh">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted-foreground)', fontSize: 'var(--t-small)', marginBottom: 12 }}>
            <span className="linkbtn" style={{ color: 'var(--muted-foreground)' }} onClick={() => go('tickets')}><Icon name="arrowLeft" size={14} />Tickets</span>
            <span>/</span>
            <span className="mono">#{ticket.number}</span>
            <TypeBadge type={ticket.type} />
            {ticket.parentId && (
              <span className="linkbtn" style={{ color: 'var(--muted-foreground)', display: 'inline-flex', alignItems: 'center', gap: 4 }} onClick={() => go('tickets', { ticketId: ticket.parentId! })}>
                <Icon name="gitBranch" size={13} />
                Subtask of {parentTicket ? `#${parentTicket.number}` : 'a ticket'}
              </span>
            )}
          </div>
          <h1 className="dh-title">{ticket.title}</h1>
          <div className="dh-meta">
            <StatusPill status={ticket.status} />
            <PriorityTag priority={ticket.priority} />
            <span className="m-sep" />
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              Assignee {ticket.assigneeId ? <AvatarName user={ticket.assigneeId ? umap[ticket.assigneeId] : null} /> : <span className="avatar-none">Unassigned</span>}
            </span>
            <span className="m-sep" />
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name="clock" size={13} />Updated {relTime(ticket.updatedAt)}</span>
          </div>
          <div className="dtabs">
            {TABS.map((t) => (
              <div key={t.id} className={'viewtab' + (tab === t.id ? ' active' : '')} onClick={() => setTab(t.id)}>
                <Icon name={t.icon} size={14} />
                {t.label}
                {t.id === 'subtasks' && <span className="vt-count">{subtasks.length || 0}</span>}
                {t.id === 'linked' && <span className="vt-count">{(linksQ.data ?? []).length || 0}</span>}
                {t.id === 'files' && <span className="vt-count">{(attachmentsQ.data ?? []).length || 0}</span>}
              </div>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {tab === 'activity' && (
            <>
              <div style={{ paddingTop: 20 }}>
                <AgentSummary
                  triage={triageData}
                  summary={aiSummary}
                  loading={summaryLoading}
                  onSummarize={runSummary}
                  enabled={summaryEnabled}
                />
              </div>
              <div className="timeline" style={{ flex: 1, paddingTop: 18 }}>
                {events.map((ev, i) => (
                  <TimelineItem key={i} ev={ev} />
                ))}
              </div>
              <div className="composer">
                {showDraft && draftEnabled && (
                  <AiDraftCard
                    draft={aiDraft}
                    loading={draftLoading}
                    onGenerate={runDraft}
                    onUse={() => { setComment(aiDraft); setShowDraft(false); }}
                    onDismiss={() => setShowDraft(false)}
                  />
                )}
                <div className="composer-box">
                  <textarea
                    placeholder={internal ? 'Add an internal note (only agents can see this)…' : 'Reply to the requester…'}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submitComment(); }}
                  />
                  <div className="composer-bar">
                    <button className="seg" style={{ background: 'transparent', border: 'none', padding: 0 }} />
                    <div className="seg">
                      <button className={!internal ? 'active' : ''} onClick={() => setInternal(false)}><Icon name="message" size={13} />Public</button>
                      <button className={internal ? 'active' : ''} onClick={() => setInternal(true)}><Icon name="lock" size={13} />Internal</button>
                    </div>
                    <div style={{ flex: 1 }} />
                    <span style={{ fontSize: 'var(--t-caption)', color: 'var(--faint-foreground)', marginRight: 8, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Kbd>⌘</Kbd><Kbd>↵</Kbd> send
                    </span>
                    <Button variant="primary" size="sm" icon="send" onClick={submitComment}>{internal ? 'Add note' : 'Send'}</Button>
                  </div>
                </div>
              </div>
            </>
          )}

          {tab === 'details' && (
            <div className="timeline" style={{ display: 'block' }}>
              <div className="card card-pad" style={{ maxWidth: 640 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div className="form-section-title" style={{ margin: 0 }}>{TYPE_MAP[ticket.type]?.label ?? ticket.type} fields</div>
                  <Button variant="outline" size="sm" icon="edit" onClick={() => setEditingDetails((e) => !e)}>{editingDetails ? 'Done' : 'Edit'}</Button>
                </div>
                {(schema?.definition.fields ?? []).filter((f) => f.key !== 'title').map((f) => {
                  const val = ticket.data[f.key] ?? '';
                  if (!editingDetails) {
                    return (
                      <div className="prop-row" key={f.key} style={{ gridTemplateColumns: '140px 1fr' }}>
                        <div className="prop-label">{f.label}</div>
                        <div className="prop-val">{f.type === 'boolean' ? (val ? 'Yes' : 'No') : (String(val) || '—')}</div>
                      </div>
                    );
                  }
                  if (f.type === 'select' && f.config?.options) {
                    const opts = (f.config.options as string[]).map((o) => ({ value: o, label: o }));
                    return (
                      <div className="prop-row" key={f.key} style={{ gridTemplateColumns: '140px 1fr' }}>
                        <div className="prop-label">{f.label}</div>
                        <div className="prop-val">
                          <PropSelect value={String(val)} options={[{ value: '', label: '—' }, ...opts]} onChange={(v) => update.mutate({ data: { ...ticket.data, [f.key]: v || undefined } })} />
                        </div>
                      </div>
                    );
                  }
                  if (f.type === 'boolean') {
                    return (
                      <div className="prop-row" key={f.key} style={{ gridTemplateColumns: '140px 1fr' }}>
                        <div className="prop-label">{f.label}</div>
                        <div className="prop-val">
                          <span className="prop-edit" style={{ cursor: 'pointer' }} onClick={() => update.mutate({ data: { ...ticket.data, [f.key]: !val } })}>
                            {val ? 'Yes' : 'No'}
                          </span>
                        </div>
                      </div>
                    );
                  }
                  if (f.type === 'long-text' || f.type === 'rich-text') {
                    return (
                      <div className="prop-row" key={f.key} style={{ gridTemplateColumns: '140px 1fr' }}>
                        <div className="prop-label">{f.label}</div>
                        <div className="prop-val">
                          <textarea
                            key={`${f.key}-${val}`}
                            defaultValue={String(val)}
                            onBlur={(e) => { if (e.target.value !== String(val)) update.mutate({ data: { ...ticket.data, [f.key]: e.target.value || undefined } }); }}
                            placeholder="—"
                            rows={3}
                            style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '6px 8px', font: 'inherit', outline: 'none', width: '100%', color: 'var(--foreground)', resize: 'vertical' }}
                          />
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div className="prop-row" key={f.key} style={{ gridTemplateColumns: '140px 1fr' }}>
                      <div className="prop-label">{f.label}</div>
                      <div className="prop-val">
                        <input
                          key={`${f.key}-${val}`}
                          type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                          defaultValue={String(val)}
                          onBlur={(e) => {
                            const raw = e.target.value;
                            if (raw === String(val)) return;
                            const v = f.type === 'number' ? (raw ? Number(raw) : undefined) : (raw || undefined);
                            update.mutate({ data: { ...ticket.data, [f.key]: v } });
                          }}
                          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                          placeholder="—"
                          style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '4px 8px', font: 'inherit', outline: 'none', width: '100%', color: 'var(--foreground)' }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {tab === 'subtasks' && (
            <div className="timeline" style={{ display: 'block' }}>
              <div className="card" style={{ maxWidth: 640 }}>
                {subtasks.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--border)', color: 'var(--muted-foreground)', fontSize: 'var(--t-caption)' }}>
                    <Icon name="checkCircle" size={14} />
                    <span>{subtasksDone} of {subtasks.length} done</span>
                  </div>
                )}
                {subtasks.length === 0 ? (
                  <div className="muted" style={{ padding: 12 }}>No subtasks yet. Break this ticket down into smaller pieces of work below.</div>
                ) : subtasks.map((s) => {
                  const done = ['resolved', 'closed'].includes(s.status ?? '');
                  return (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                      <span className="t-ico" style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--muted)', color: 'var(--muted-foreground)', display: 'grid', placeItems: 'center', cursor: 'pointer' }} onClick={() => go('tickets', { ticketId: s.id })}><Icon name={done ? 'checkCircle' : 'ticket'} size={16} /></span>
                      <div style={{ flex: 1, cursor: 'pointer', minWidth: 0 }} onClick={() => go('tickets', { ticketId: s.id })}>
                        <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: done ? 'line-through' : 'none', color: done ? 'var(--muted-foreground)' : 'var(--foreground)' }}>
                          <span className="mono" style={{ color: 'var(--muted-foreground)', marginRight: 6 }}>#{s.number}</span>
                          {(s.data as Record<string, unknown>).title as string ?? 'Untitled'}
                        </div>
                      </div>
                      <StatusPill status={s.status ?? 'open'} />
                    </div>
                  );
                })}
                <div style={{ borderTop: subtasks.length > 0 ? '1px solid var(--border)' : 'none', padding: 12, display: 'flex', gap: 8 }}>
                  <input
                    placeholder="Add a subtask…"
                    value={newSubtask}
                    onChange={(e) => setNewSubtask(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') addSubtask(); }}
                    style={{ flex: 1, padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', background: 'var(--surface)', color: 'var(--foreground)', font: 'inherit', fontSize: 'var(--t-small)', outline: 'none' }}
                  />
                  <Button variant="primary" size="sm" icon="plus" onClick={addSubtask} disabled={!newSubtask.trim() || createSubtask.isPending}>Add</Button>
                </div>
              </div>
            </div>
          )}
          {tab === 'linked' && (
            <div className="timeline" style={{ display: 'block' }}>
              <div className="card" style={{ maxWidth: 640 }}>
                {(linksQ.data ?? []).length === 0 ? (
                  <div className="muted" style={{ padding: 12 }}>No linked records.</div>
                ) : (linksQ.data ?? []).map((l) => {
                  const linkedTicket = l.toType === 'ticket' ? (allTicketsQ.data?.rows ?? []).find((t) => t.id === l.toId) : null;
                  const label = linkedTicket ? `#${linkedTicket.number} ${(linkedTicket.data as Record<string, unknown>).title ?? ''}` : l.toId.slice(0, 8);
                  const icon = l.toType === 'ticket' ? 'ticket' as const : 'box' as const;
                  return (
                    <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
                      <span className="t-ico" style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--muted)', color: 'var(--muted-foreground)', display: 'grid', placeItems: 'center', cursor: 'pointer' }} onClick={() => { if (l.toType === 'ticket') go('tickets', { ticketId: l.toId }); else if (l.toType === 'asset') go('assets', { assetId: l.toId }); }}><Icon name={icon} size={16} /></span>
                      <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => { if (l.toType === 'ticket') go('tickets', { ticketId: l.toId }); else if (l.toType === 'asset') go('assets', { assetId: l.toId }); }}><div style={{ fontWeight: 600 }}>{label} <span className="badge" style={{ marginLeft: 6 }}>{l.toType}</span></div>
                        <div style={{ color: 'var(--muted-foreground)', fontSize: 'var(--t-caption)' }}>{l.relationshipType}</div></div>
                      <IconButton name="x" small title="Remove link" onClick={() => removeLink.mutate(l.id)} />
                    </div>
                  );
                })}
                <div style={{ borderTop: '1px solid var(--border)', padding: 12 }}>
                  <Button variant="ghost" size="sm" icon="plus" onClick={() => setLinkOpen(true)}>Link a record</Button>
                </div>
              </div>
            </div>
          )}
          {tab === 'files' && (
            <div className="timeline" style={{ display: 'block' }}>
              <div className="card" style={{ maxWidth: 640 }}>
                {(attachmentsQ.data ?? []).length === 0 ? (
                  <div className="muted" style={{ padding: 16 }}>No files attached.</div>
                ) : (attachmentsQ.data ?? []).map((a, i) => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: i < ((attachmentsQ.data ?? []).length - 1) ? '1px solid var(--border)' : 'none' }}>
                    <span className="t-ico" style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--muted)', color: 'var(--muted-foreground)', display: 'grid', placeItems: 'center' }}><Icon name="paperclip" size={15} /></span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 'var(--t-small)' }}>{a.filename}</div>
                      <div style={{ color: 'var(--muted-foreground)', fontSize: 'var(--t-caption)' }}>{fmtSize(a.size)}</div>
                    </div>
                    <IconButton name="download" small title="Download" onClick={() => downloadAttachment(a)} />
                    <IconButton name="x" small title="Delete" onClick={() => delAtt.mutate(a.id)} />
                  </div>
                ))}
                <div style={{ borderTop: '1px solid var(--border)', padding: 12 }}>
                  <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                    <Icon name="plus" size={14} /> Upload file
                    <input type="file" aria-label="Upload file" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); e.target.value = ''; }} />
                  </label>
                  {upload.isPending && <span className="muted" style={{ marginLeft: 8 }}>Uploading…</span>}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <aside className="detail-rail">
        <div className="props">
          <div className="rail-sect">Properties</div>
          <PropRow label="Status">
            <PropSelect
              value={ticket.status}
              options={Object.keys(STATUS_MAP).filter((k) => k !== 'new').map((k) => ({ value: k, label: STATUS_MAP[k].label, dot: STATUS_MAP[k].tone === 'success' ? 'var(--success)' : STATUS_MAP[k].tone === 'warning' ? 'var(--warning)' : STATUS_MAP[k].tone === 'info' ? 'var(--info)' : 'var(--faint-foreground)' }))}
              onChange={(v) => update.mutate({ status: v })}
            />
          </PropRow>
          <PropRow label="Priority">
            <PropSelect
              value={ticket.priority}
              options={Object.keys(PRIORITY_MAP).map((k) => ({ value: k, label: PRIORITY_MAP[k].label, dot: k === 'urgent' ? 'var(--danger)' : k === 'high' ? 'var(--warning)' : k === 'medium' ? 'var(--info)' : 'var(--faint-foreground)' }))}
              onChange={(v) => update.mutate({ priority: v })}
            />
          </PropRow>
          <PropRow label="Assignee">
            <PropSelect
              value={ticket.assigneeId ?? ''}
              options={[{ value: '', label: 'Unassigned' }, ...(usersQ.data ?? []).filter((u) => u.role !== 'requester').map((u) => ({ value: u.id, label: u.name }))]}
              onChange={(v) => update.mutate({ assigneeId: v || null })}
            />
          </PropRow>
          <PropRow label="Team">
            <PropSelect
              value={ticket.teamId ?? ''}
              options={[{ value: '', label: 'Unassigned' }, ...(teamsQ.data ?? []).map((t) => ({ value: t.id, label: t.name }))]}
              onChange={(v) => update.mutate({ teamId: v || null })}
            />
          </PropRow>
          <PropRow label="Requester">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><Avatar user={req ?? undefined} size="sm" />{req?.name ?? '—'}</span>
          </PropRow>
          <PropRow label="Created"><span title={absTime(ticket.createdAt)}>{relTime(ticket.createdAt)}</span></PropRow>
          <PropRow label="Due (SLA)">
            <EditableProp>
              <input
                type="date"
                aria-label="Due"
                value={ticket.dueAt ? new Date(ticket.dueAt).toISOString().slice(0, 10) : ''}
                onChange={(e) => { const v = e.target.value; update.mutate({ dueAt: v ? new Date(v).toISOString() : null }); }}
                style={{ background: 'transparent', border: 'none', padding: 0, font: 'inherit', cursor: 'pointer', outline: 'none' }}
              />
            </EditableProp>
            {due && (
              <span className={'pill pill-' + (due.tone === 'muted' ? 'neutral' : due.tone)} style={{ height: 20 }}>
                <Icon name="clock" size={11} />{due.breached ? 'Breached ' : ''}{due.label}
              </span>
            )}
          </PropRow>

          {(ticket.slaResponseDueAt || ticket.slaResolutionDueAt) && (
            <>
              <div className="rail-div" />
              <div className="rail-sect">SLA</div>
              {ticket.slaResponseDueAt && (
                <PropRow label="Response due">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span title={ticket.slaResponseDueAt}>{relTime(Date.parse(ticket.slaResponseDueAt))}</span>
                    {ticket.slaResponseBreachedAt
                      ? <span className="pill pill-danger" style={{ height: 20 }}><Icon name="alert" size={11} />Breached</span>
                      : null}
                  </span>
                </PropRow>
              )}
              {ticket.slaResolutionDueAt && (
                <PropRow label="Resolution due">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span title={ticket.slaResolutionDueAt}>{relTime(Date.parse(ticket.slaResolutionDueAt))}</span>
                    {ticket.slaResolutionBreachedAt
                      ? <span className="pill pill-danger" style={{ height: 20 }}><Icon name="alert" size={11} />Breached</span>
                      : null}
                  </span>
                </PropRow>
              )}
            </>
          )}

          {csatSurvey && (
            <>
              <div className="rail-div" />
              <div className="rail-sect">Satisfaction</div>
              {csatSurvey.respondedAt ? (
                <>
                  <PropRow label="Rating">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, color: 'var(--warning)' }} title={`${csatSurvey.rating}/5`}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Icon key={n} name="star" size={14} style={(csatSurvey.rating ?? 0) >= n ? { fill: 'currentColor' } : { color: 'var(--faint-foreground)' }} />
                      ))}
                      <span style={{ marginLeft: 6, color: 'var(--foreground)' }}>{csatSurvey.rating}/5</span>
                    </span>
                  </PropRow>
                  <PropRow label="Rated"><span title={absTime(Date.parse(csatSurvey.respondedAt))}>{relTime(Date.parse(csatSurvey.respondedAt))}</span></PropRow>
                  {csatSurvey.comment && (
                    <div className="prop-row" style={{ gridTemplateColumns: '1fr' }}>
                      <div className="prop-val" style={{ fontStyle: 'italic', color: 'var(--muted-foreground)' }}>&ldquo;{csatSurvey.comment}&rdquo;</div>
                    </div>
                  )}
                </>
              ) : (
                <PropRow label="Survey">
                  <span className="pill pill-neutral" style={{ height: 20 }}><Icon name="clock" size={11} />Awaiting response</span>
                </PropRow>
              )}
            </>
          )}

          <div className="rail-div" />
          <div className="rail-sect">Custom fields</div>
          {(schema?.definition.fields ?? []).filter((f) => f.key !== 'title').map((f) => {
            const val = ticket.data[f.key] ?? '';
            if (f.type === 'select' && f.config?.options) {
              const opts = (f.config.options as string[]).map((o) => ({ value: o, label: o }));
              return (
                <PropRow key={f.key} label={f.label}>
                  <PropSelect value={String(val)} options={[{ value: '', label: '—' }, ...opts]} onChange={(v) => update.mutate({ data: { ...ticket.data, [f.key]: v || undefined } })} />
                </PropRow>
              );
            }
            if (f.type === 'boolean') {
              return (
                <PropRow key={f.key} label={f.label}>
                  <span className="prop-edit" style={{ cursor: 'pointer' }} onClick={() => update.mutate({ data: { ...ticket.data, [f.key]: !val } })}>
                    {val ? 'Yes' : 'No'}
                  </span>
                </PropRow>
              );
            }
            return (
              <div className="prop-row" key={f.key} style={{ gridTemplateColumns: '140px 1fr' }}>
                <div className="prop-label">{f.label}</div>
                <div className="prop-val">
                  <input
                    key={`${f.key}-${val}`}
                    type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                    defaultValue={String(val)}
                    onBlur={(e) => {
                      const raw = e.target.value;
                      if (raw === String(val)) return;
                      const v = f.type === 'number' ? (raw ? Number(raw) : undefined) : (raw || undefined);
                      update.mutate({ data: { ...ticket.data, [f.key]: v } });
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                    placeholder="—"
                    style={{ background: 'transparent', border: 'none', padding: 0, font: 'inherit', outline: 'none', width: '100%', color: 'var(--foreground)' }}
                  />
                </div>
              </div>
            );
          })}

          <div className="rail-div" />
          <Button variant="outline" size="sm" icon="checkCircle" style={{ width: '100%' }} disabled={['resolved', 'closed'].includes(ticket.status)} onClick={() => update.mutate({ status: 'resolved' })}>Mark resolved</Button>

          <AiInsights
            similar={similarQ.data ?? []}
            loading={similarEnabled && similarQ.isLoading}
            error={similarEnabled && similarQ.isError}
            enabled={similarEnabled}
            onOpen={(tid) => go('tickets', { ticketId: tid })}
          />
        </div>
      </aside>
      {linkOpen && <LinkDialog ticketId={ticketId} onClose={() => setLinkOpen(false)} onLinked={() => linksQ.refetch()} />}
    </div>
  );
}
