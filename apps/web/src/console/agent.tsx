// SPDX-License-Identifier: AGPL-3.0-only

/* Agent ("Tess") — components + mock agentic behavior. Ported from the design handoff. */
import { useEffect, useState, type ReactNode } from 'react';
import { Icon } from './icons';
import { IconButton, relTime } from './ui';
import { askTess } from '../api/ai';
import { useBot } from './bot';
import { useDashboard } from './dashboard.queries';

/* ---- Orb (assistant avatar) — renders the org's custom emoji/monogram when set ---- */
export function Orb({ size = 'md', thinking = false, title }: { size?: string; thinking?: boolean; title?: string }) {
  const bot = useBot();
  return (
    <span className={'orb ' + size + (thinking ? ' thinking' : '')} title={title || `${bot.name} — your triage agent`}>
      {bot.icon && <span className="orb-ic" aria-hidden="true">{bot.icon}</span>}
    </span>
  );
}


/* ---- Dashboard hero band — real Tess activity + a "today so far" summary (or a CTA when AI is off) ---- */
type DayToday = { created: number; resolved: number; triaged: number };
type TessStats = { enabled: boolean; triaged: number; indexed: number; flagged: number };
type RecentTriage = { ticketId: string; number: number | null; title: string; category: string | null; priority: string | null; at: string };

export function AgentBand({
  go,
  tess,
  today,
  recent,
}: {
  go: (s: string, e?: any) => void;
  tess?: TessStats;
  today?: DayToday;
  recent?: RecentTriage[];
}) {
  const bot = useBot();
  if (!tess?.enabled) {
    return (
      <div className="agent-band">
        <div className="agent-band-row">
          <Orb size="xl" />
          <div>
            <div className="agent-headline">
              Meet <span className="ai-grad-text">{bot.name}</span>, your AI service-desk agent.
            </div>
            <div className="agent-sub">Turn on summaries, draft replies, auto-triage, and similar-ticket search.</div>
          </div>
          <div className="agent-stats">
            <span className="linkbtn" style={{ whiteSpace: 'nowrap' }} onClick={() => go('settings')}>
              Enable {bot.name} AI <Icon name="arrowRight" size={13} />
            </span>
          </div>
        </div>
      </div>
    );
  }
  const d = today ?? { created: 0, resolved: 0, triaged: 0 };
  const feed = recent ?? [];
  return (
    <div className="agent-band">
      <div className="agent-band-row">
        <Orb size="xl" />
        <div>
          <div className="agent-headline">
            {bot.name} has triaged <span className="ai-grad-text">{tess.triaged} {tess.triaged === 1 ? 'ticket' : 'tickets'}</span> for your desk.
          </div>
          <div className="agent-sub">
            {tess.indexed} indexed for similar-ticket search
            {tess.flagged > 0 ? ` · ${tess.flagged} flagged for your review` : ''}
          </div>
        </div>
        <div className="agent-stats">
          {([
            [String(d.created), 'Created today', 'plus'],
            [String(d.resolved), 'Resolved today', 'checkCheck'],
            [String(d.triaged), 'Triaged today', 'wand'],
          ] as const).map(([n, l, ic]) => (
            <div className="agent-stat" key={l}>
              <div className="as-num"><span className="ai-grad-text">{n}</span></div>
              <div className="as-lab"><Icon name={ic} size={12} />{l}</div>
            </div>
          ))}
        </div>
      </div>
      {feed.length > 0 && (
        <div className="agent-feed">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span className="afeed-live"><span className="lv" />Recent {bot.name} activity</span>
            {tess.flagged > 0 && (
              <span className="linkbtn" style={{ fontSize: 'var(--t-caption)', whiteSpace: 'nowrap' }} onClick={() => go('tickets', { view: 'unassigned' })}>
                Review flagged <Icon name="arrowRight" size={13} />
              </span>
            )}
          </div>
          {feed.map((f) => (
            <div className="afeed-item" key={f.ticketId} style={{ cursor: 'pointer' }} onClick={() => go('tickets', { ticketId: f.ticketId })}>
              <span className="af-ico"><Icon name="wand" size={13} /></span>
              <span className="af-text">
                Triaged <b>#{f.number ?? '—'} {f.title}</b>
                {f.category ? <> as {f.category}</> : null}
                {f.priority ? <> · {f.priority} priority</> : null}
              </span>
              <span className="af-time">{relTime(Date.parse(f.at))}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---- List triage banner ---- */
export function TriageBanner({ go }: { go: (s: string, e?: any) => void }) {
  const { data } = useDashboard();
  const bot = useBot();
  const tess = data?.tess;
  // Only show when the assistant is on and has actually triaged something in this queue.
  if (!tess?.enabled || tess.triaged === 0) return null;
  return (
    <div className="triage-banner">
      <Orb size="md" />
      <div className="tb-txt">
        <b>{bot.name} triaged {tess.triaged} {tess.triaged === 1 ? 'ticket' : 'tickets'}</b> — auto-categorized &amp; prioritized
        {tess.flagged > 0 ? <> · {tess.flagged} flagged for your review</> : null}.
      </div>
      <div style={{ flex: 1 }} />
      {tess.flagged > 0 && (
        <button className="ai-btn ghost" onClick={() => go('tickets', { view: 'unassigned' })}>
          Review
        </button>
      )}
    </div>
  );
}

/* ---- Detail: AI thread summary (real, on-demand streamed) ---- */
export function AgentSummary({
  triage,
  summary,
  loading,
  onSummarize,
  enabled,
}: {
  triage: { confidence: number | null; category: string | null; priority: string | null } | null;
  summary: string;
  loading: boolean;
  onSummarize: () => void;
  enabled: boolean;
}) {
  const [open, setOpen] = useState(true);
  const bot = useBot();
  if (!enabled) return null;
  const conf = triage?.confidence ?? null;
  return (
    <div className="ai-card grad-edge" style={{ margin: '0 28px' }}>
      <div className="ai-card-pad">
        <div className="ai-head">
          <Orb size="sm" thinking={loading} />
          <span className="ai-name">Summary by {bot.name}</span>
          {conf != null && (
            <span className="conf" style={{ marginLeft: 4 }}>
              <span className="conf-bar"><i style={{ width: Math.round(conf * 100) + '%' }} /></span>
              {Math.round(conf * 100)}% confident
            </span>
          )}
          <div style={{ flex: 1 }} />
          <IconButton name={open ? 'chevronUp' : 'chevronDown'} small onClick={() => setOpen((o) => !o)} />
        </div>
        {open && (
          <>
            {triage && (
              <div className="ai-meta" style={{ marginTop: 8 }}>
                Triaged as <b>{triage.category ?? 'uncategorized'}</b> · priority <b>{triage.priority ?? '—'}</b>
              </div>
            )}
            {summary ? (
              <div style={{ marginTop: 10, fontSize: 'var(--t-small)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{summary}</div>
            ) : (
              <button className="ai-btn" style={{ marginTop: 10 }} disabled={loading} onClick={onSummarize}>
                <Icon name="sparkles" size={13} />{loading ? 'Summarizing…' : `Summarize with ${bot.name}`}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ---- Detail: suggested reply draft (real, on-demand streamed) ---- */
export function AiDraftCard({
  draft,
  loading,
  onGenerate,
  onUse,
  onDismiss,
}: {
  draft: string;
  loading: boolean;
  onGenerate: () => void;
  onUse: () => void;
  onDismiss: () => void;
}) {
  const bot = useBot();
  return (
    <div className="ai-card" style={{ marginBottom: 12 }}>
      <div className="ai-card-pad">
        <div className="ai-head" style={{ marginBottom: 8 }}>
          <Orb size="sm" thinking={loading} />
          <span className="ai-name">Suggested reply</span>
          <span className="ai-chip"><Icon name="sparkles" size={11} />{bot.name}</span>
          <div style={{ flex: 1 }} />
          <IconButton name="x" small title="Dismiss" onClick={onDismiss} />
        </div>
        {draft ? (
          <div className="ai-draft" style={{ whiteSpace: 'pre-wrap' }}>{draft}</div>
        ) : (
          <div className="ai-meta">Generate a draft reply for this ticket.</div>
        )}
        <div className="ai-actions">
          {draft ? (
            <button className="ai-btn solid" onClick={onUse}><Icon name="check" size={14} />Use this reply</button>
          ) : (
            <button className="ai-btn solid" disabled={loading} onClick={onGenerate}>
              <Icon name="wand" size={14} />{loading ? 'Drafting…' : `Draft reply with ${bot.name}`}
            </button>
          )}
          {draft && (
            <button className="ai-btn" disabled={loading} onClick={onGenerate}>
              <Icon name="refresh" size={13} />Regenerate
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---- Detail rail: similar tickets (real) ---- */
export function AiInsights({
  similar,
  loading,
  error,
  enabled,
  onOpen,
}: {
  similar: { id: string; number: number | null; title: string | null; status: string | null }[];
  loading: boolean;
  error?: boolean;
  enabled: boolean;
  onOpen: (ticketId: string) => void;
}) {
  if (!enabled) return null;
  return (
    <>
      <div className="rail-div" />
      <div className="rail-sect" style={{ display: 'flex', alignItems: 'center', gap: 7 }}><Orb size="sm" />Similar tickets</div>
      {loading && <div className="ii-sub" style={{ opacity: 0.7 }}>Loading similar tickets…</div>}
      {!loading && error && <div className="ii-sub" style={{ opacity: 0.7 }}>Could not load similar tickets.</div>}
      {!loading && !error && similar.length === 0 && <div className="ii-sub" style={{ opacity: 0.7 }}>No similar tickets found.</div>}
      {!loading && !error && similar.map((s) => (
        <div
          className="ai-insight-row"
          key={s.id}
          style={{ cursor: 'pointer' }}
          role="button"
          tabIndex={0}
          onClick={() => onOpen(s.id)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { if (e.key === ' ') e.preventDefault(); onOpen(s.id); } }}
        >
          <span className="ii-ico"><Icon name="gitMerge" size={14} /></span>
          <div style={{ minWidth: 0 }}>
            <div className="ii-title" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span className="mono" style={{ color: 'var(--ai-text)' }}>#{s.number ?? '—'}</span>
              {s.status && <span className="ii-sub" style={{ opacity: 0.7 }}>{s.status}</span>}
            </div>
            <div className="ii-sub" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title ?? 'Untitled'}</div>
          </div>
        </div>
      ))}
    </>
  );
}

/* ---- Ask Tess: real read-only queue search ---- */
export const ASK_SUGGESTIONS = [
  { icon: 'alert', q: 'Show open tickets past their due date' },
  { icon: 'user', q: 'Show unassigned hardware tickets' },
  { icon: 'wand', q: 'What open tickets are high priority?' },
  { icon: 'checkCheck', q: 'Show resolved tickets from this week' },
];

function linkifyTicketRefs(text: string, byNumber: Map<number, string>, onOpen: (id: string) => void): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /#(\d+)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const num = Number(m[1]);
    const id = byNumber.get(num);
    out.push(
      id ? (
        <span key={key++} className="mono ai-text" style={{ cursor: 'pointer' }} onClick={() => onOpen(id)}>#{num}</span>
      ) : (
        <span key={key++} className="mono">#{num}</span>
      ),
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function AskTessResult({ query, onOpenTicket }: { query: string; onOpenTicket: (id: string) => void }) {
  const bot = useBot();
  const [loading, setLoading] = useState(true);
  const [answer, setAnswer] = useState('');
  const [tickets, setTickets] = useState<{ number: number | null; id: string; title: string; status: string | null }[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setAnswer('');
    setTickets([]);
    askTess(query)
      .then((r) => { if (!cancelled) { setAnswer(r.answer); setTickets(r.tickets); } })
      .catch((e) => { if (!cancelled) setError((e as Error).message || `${bot.name} could not answer that.`); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [query]);

  const byNumber = new Map<number, string>();
  for (const t of tickets) if (t.number != null) byNumber.set(t.number, t.id);

  return (
    <div className="ask-answer">
      <div className="ai-head" style={{ marginBottom: 10 }}>
        <Orb size="md" thinking={loading} />
        <div><div className="ai-name">{bot.name}</div><div className="ai-meta">{loading ? 'Searching the queue…' : error ? 'Something went wrong' : "Here's what I found"}</div></div>
      </div>
      {loading && <div className="ask-typing"><i /><i /><i /></div>}
      {!loading && error && <div className="ai-card"><div className="ai-card-pad danger">{error}</div></div>}
      {!loading && !error && (
        <div className="ai-card">
          <div className="ai-card-pad">
            <div className="ai-draft">{linkifyTicketRefs(answer, byNumber, onOpenTicket)}</div>
            {tickets.length > 0 && (
              <div className="ai-actions" style={{ flexWrap: 'wrap' }}>
                {tickets.map((t) => (
                  <button key={t.id} className="ai-btn" onClick={() => onOpenTicket(t.id)}>
                    <Icon name="ticket" size={13} />#{t.number ?? '?'} {t.title.length > 28 ? t.title.slice(0, 28) + '…' : t.title}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
