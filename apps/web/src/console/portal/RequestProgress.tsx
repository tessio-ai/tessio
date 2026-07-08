// SPDX-License-Identifier: AGPL-3.0-only

/* Requester portal — progress view for one submitted request. */
import { useState, type CSSProperties } from 'react';
import { Icon } from '../icons';
import { useAuth } from '../../auth/AuthContext';
import { useMyTicket, useMyTicketActivity, useMyTicketComments, useReplyToTicket, usePublicPortalSettings } from './queries';
import { PROGRESS_STEPS, progressStep, statusLabel, buildTimeline, type TimelineEntry } from './progress';

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const fmtTime = (iso: string) => new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

function ProgressSteps({ status }: { status: string | null }) {
  const step = progressStep(status);
  return (
    <ol className="rp-steps" aria-label="Request progress">
      {PROGRESS_STEPS.map((label, i) => (
        <li key={label} className={'rp-step' + (i < step ? ' done' : i === step ? ' current' : '')} aria-current={i === step ? 'step' : undefined}>
          <span className="rp-step-dot" aria-hidden="true">{i < step ? <Icon name="check" size={11} strokeWidth={3} /> : null}</span>
          <span className="rp-step-label">{i === step && step === 1 ? statusLabel(status) : label}</span>
        </li>
      ))}
    </ol>
  );
}

function TimelineItem({ entry, mine, initials }: { entry: TimelineEntry; mine: boolean; initials: string }) {
  if (entry.kind === 'comment') {
    return (
      <li className={'rp-msg' + (mine ? ' mine' : '')}>
        <span className="rp-msg-ava" aria-hidden="true">{mine ? initials : <Icon name="user" size={14} />}</span>
        <div className="rp-msg-main">
          <div className="rp-msg-meta"><b>{mine ? 'You' : 'Support team'}</b><span>{fmtTime(entry.at)}</span></div>
          <div className="rp-msg-bubble">{entry.body}</div>
        </div>
      </li>
    );
  }
  const text = entry.kind === 'created' ? 'Request submitted' : `Status changed to ${statusLabel(entry.to)}`;
  return (
    <li className="rp-tl-sys">
      <span className="rp-tl-sys-pill">
        <Icon name={entry.kind === 'created' ? 'ticket' : 'activity'} size={11} />
        {text}
        <span className="rp-tl-sys-time">{fmtTime(entry.at)}</span>
      </span>
    </li>
  );
}

export function RequestProgress({ ticketId, onBack, onNewRequest }: { ticketId: string; onBack: () => void; onNewRequest: () => void }) {
  const { user } = useAuth();
  const { data: settings } = usePublicPortalSettings();
  const accent = { ['--pa']: settings?.accent ?? '#4f46e5' } as CSSProperties;
  const ticketQ = useMyTicket(ticketId);
  const activityQ = useMyTicketActivity(ticketId);
  const commentsQ = useMyTicketComments(ticketId);
  const reply = useReplyToTicket(ticketId);
  const [draft, setDraft] = useState('');

  if (ticketQ.isLoading) return <div className="rp-body"><p className="muted" style={{ padding: 24 }}>Loading…</p></div>;
  if (ticketQ.isError || !ticketQ.data) {
    return (
      <div className="rp-body"><div className="rp-request" style={accent}>
        <button type="button" className="rp-back" onClick={onBack}><Icon name="arrowLeft" size={16} />My requests</button>
        <p className="danger" style={{ padding: '16px 0' }}>Couldn't load this request.</p>
      </div></div>
    );
  }

  const t = ticketQ.data;
  const title = (t.data.title as string) || `Request #${t.number ?? '—'}`;
  const timeline = buildTimeline(activityQ.data ?? [], commentsQ.data ?? []);
  const closed = t.status === 'closed';
  const initials = (user?.name ?? '').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase() || 'U';

  async function onSend() {
    const body = draft.trim();
    if (!body) return;
    try {
      await reply.mutateAsync(body);
      setDraft('');
    } catch { /* surfaced via reply.error */ }
  }

  return (
    <div className="rp-body">
      <div className="rp-request" style={accent}>
        <button type="button" className="rp-back" onClick={onBack}><Icon name="arrowLeft" size={16} />My requests</button>

        <div className="rp-req-head">
          <div className="rp-req-headline">
            <h2 className="rp-req-title">{title}</h2>
            <span className="rp-status-chip" data-status={t.status ?? 'open'}>{statusLabel(t.status)}</span>
          </div>
          <div className="rp-req-sub">#{t.number ?? '—'} · submitted {fmtDate(t.createdAt)}</div>
        </div>

        <ProgressSteps status={t.status} />

        <section className="rp-timeline-wrap" aria-label="Request activity">
          {activityQ.isLoading || commentsQ.isLoading ? (
            <p className="muted">Loading activity…</p>
          ) : (
            <ol className="rp-timeline">
              {timeline.map((e) => <TimelineItem key={`${e.kind}:${e.id}`} entry={e} mine={e.kind === 'comment' && e.authorId === user?.id} initials={initials} />)}
            </ol>
          )}
        </section>

        {closed ? (
          <div className="rp-closed-note">
            <span className="rp-closed-ico" aria-hidden="true"><Icon name="checkCircle" size={16} /></span>
            <span>This request is closed. Need more help?</span>
            <button type="button" className="ps-btn rp-closed-cta" onClick={onNewRequest}>Submit a new request</button>
          </div>
        ) : (
          <div className="rp-reply">
            <label className="sr-only" htmlFor="rp-reply-input">Reply to the support team</label>
            <textarea
              id="rp-reply-input"
              className="rp-reply-input"
              placeholder="Add a reply for the support team…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            {reply.isError && <div className="portal-alert" role="alert">Couldn't send your reply. Please try again.</div>}
            <div className="rp-reply-bar">
              <span className="rp-reply-hint"><Icon name="lock" size={12} />Visible to you and the support team</span>
              <button type="button" className="rp-send" onClick={() => void onSend()} disabled={reply.isPending || !draft.trim()}>
                <Icon name="send" size={14} />{reply.isPending ? 'Sending…' : 'Send reply'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
