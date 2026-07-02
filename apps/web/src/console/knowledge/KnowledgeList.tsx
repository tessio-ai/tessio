// SPDX-License-Identifier: AGPL-3.0-only

import { useMemo, useState } from 'react';
import { Icon } from '../icons';
import { Orb } from '../agent';
import { Button, relTime, absTime } from '../ui';
import { useArticles } from './queries';
import { sanitizeHtml } from './sanitize';
import { CATEGORY_GROUPS } from './kb-types';
import type { ArticleData } from './kb-types';
import type { KbArticleRow } from '../../api/types';
import './knowledge.css';

type Go = (screen: string, extra?: Record<string, unknown>) => void;

/* ---- Ask Tess (canned keyword-matched synthesis) ---- */
const KB_ANSWERS = [
  { match:/vpn|connect remote|remote access/i,
    answer:"To get on the VPN, install <b>Acme Connect</b> from the Company Portal and sign in with SSO. You only need it for internal tools — disconnect when you're done to keep things fast. If it hangs on \"Connecting\", quit and relaunch the client.",
    sources:[] as string[] },
  { match:/password|locked|mfa|2fa|sign in/i,
    answer:"You can reset your own password at <b>id.acme.com</b> — no ticket needed. Locked out after too many tries? It unlocks automatically after 15 minutes. Moving to a new phone? Re-enroll MFA from a device you're still signed in on before wiping the old one.",
    sources:[] },
  { match:/print|printer|offline/i,
    answer:"A printer showing <b>offline</b> is usually a stuck job or a sleeping device. Wake the panel, clear any errored job in the print queue, and re-select the printer as default. If a whole floor sees it offline at once, it's a server-side queue — log a ticket with the asset tag.",
    sources:[] },
  { match:/wifi|wi-fi|wireless|slow|network/i,
    answer:"For Wi-Fi drops, forget the <b>Acme-Corp</b> network and rejoin to re-authenticate. Meeting-room dead spots are often a known access-point issue — check the status page first. For slowness, disconnect the VPN if you don't need it.",
    sources:[] },
  { match:/email|mail|outlook|inbox/i,
    answer:"Delayed mail is usually a temporary relay delay — give it 30 minutes. A full mailbox stops new mail, so clear large items or request more quota. Missing messages are often in the non-focused inbox or moved by a rule, not actually lost.",
    sources:[] },
  { match:/time off|vacation|leave|sick|pto/i,
    answer:"Submit time off from the People portal — it routes to your manager automatically. Vacation needs advance notice; sick days can be logged same-day. Your balance updates once the request is approved.",
    sources:[] },
  { match:/onboard|new hire|first day|new employee/i,
    answer:"New hires get a configured laptop, email, and core accounts before day one. The first steps are setting a password at <b>id.acme.com</b> and enrolling MFA — everything else depends on it. Managers can request any extra access.",
    sources:[] },
  { match:/badge|door|building access|reader/i,
    answer:"New badges are issued at the lobby desk with photo ID. Report a lost badge right away so it can be deactivated. If one reader beeps red while others work, it's likely a faulty reader — try another entrance and report it.",
    sources:[] },
];

function synthAnswer(q: string) {
  const hit = KB_ANSWERS.find(a => a.match.test(q));
  if (hit) return hit;
  return { answer: "I couldn't find a confident answer in the knowledge base for that. Try rephrasing, or browse the categories below — and if nothing fits, you can open a ticket and a person will help.", sources: [] as string[] };
}

function KbAsk({ articles, go }: { articles: KbArticleRow[]; go: Go }) {
  const [q, setQ] = useState('');
  const [asked, setAsked] = useState<{ answer: string; sources: string[] } | null>(null);
  const [thinking, setThinking] = useState(false);
  const ask = () => {
    if (!q.trim()) return;
    setThinking(true);
    setAsked(null);
    const result = synthAnswer(q);
    // match sources to actual articles by keyword overlap
    const matched = articles.filter(a => {
      const d = a.data as Partial<ArticleData>;
      const hay = ((a.title ?? '') + ' ' + (d.excerpt ?? '')).toLowerCase();
      return q.split(/\s+/).some(w => w.length > 2 && hay.includes(w.toLowerCase()));
    }).slice(0, 2);
    setTimeout(() => {
      setThinking(false);
      setAsked({ ...result, sources: matched.map(a => a.id) });
    }, 1000);
  };
  return (
    <div className="kb-ask">
      <div className="kb-ask-pad">
        <div className="kb-ask-row">
          <Orb size="lg" thinking={thinking} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="kb-ask-title">Ask Tess</div>
            <div className="kb-ask-sub">Get a synthesized answer from across the knowledge base.</div>
          </div>
        </div>
        <div className="kb-ask-field" style={{ marginTop: 14 }}>
          <Icon name="sparkles" size={17} style={{ color: 'var(--ai-text)' }} />
          <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && ask()}
            placeholder="e.g. How do I get on the VPN from home?" />
          <button className="ai-btn solid" onClick={ask}><Icon name="arrowRight" size={14} />Ask</button>
        </div>
        {thinking && (
          <div className="kb-answer">
            <span className="ask-typing"><i /><i /><i /></span>
          </div>
        )}
        {asked && (
          <div className="kb-answer">
            <div className="kb-answer-body" dangerouslySetInnerHTML={{ __html: sanitizeHtml(asked.answer) }} />
            {asked.sources.length > 0 && (
              <div className="kb-sources">
                <span style={{ fontSize: 'var(--t-caption)', color: 'var(--muted-foreground)', alignSelf: 'center', fontWeight: 600 }}>Sources</span>
                {asked.sources.map((id, i) => {
                  const a = articles.find(ar => ar.id === id);
                  if (!a) return null;
                  return (
                    <span className="kb-source" key={id} onClick={() => go('knowledge', { articleId: id })}>
                      <span className="ks-n">{i + 1}</span>{a.title}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---- Main KnowledgeList ---- */
export function KnowledgeList({ go }: { go: Go }) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const q = useArticles({ limit: 200, sort: { field: 'updatedAt', dir: 'desc', type: 'date' } });
  const all = q.data?.rows ?? [];

  const tabs = [
    { id: 'all', label: 'All articles' },
    { id: 'IT', label: 'IT & Software' },
    { id: 'HR', label: 'People & HR' },
    { id: 'FAC', label: 'Facilities' },
    { id: 'draft', label: 'Drafts' },
  ];

  const rows = useMemo(() => {
    let list = all;
    if (filter === 'draft') list = list.filter(a => a.status === 'draft');
    else if (filter !== 'all') list = list.filter(a => (a.data as Partial<ArticleData>).categoryGroup === filter);
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      list = list.filter(a => {
        const d = a.data as Partial<ArticleData>;
        return ((a.title ?? '') + ' ' + (d.excerpt ?? '')).toLowerCase().includes(s);
      });
    }
    return list;
  }, [all, filter, search]);

  const published = all.filter(a => a.status === 'published').length;

  return (
    <div className="page">
      <div className="page-header">
        <div className="ph-top">
          <div>
            <h1 className="ph-title">Knowledge Base</h1>
            <p className="ph-desc">Self-service articles that deflect tickets before they're filed.</p>
          </div>
          <div className="ph-actions">
            <Button variant="outline" icon="sparkles" size="sm">Draft with Tess</Button>
            <Button variant="primary" icon="plus" onClick={() => go('knowledge', { view: 'new' })}>New article</Button>
          </div>
        </div>
        <div className="viewtabs">
          {tabs.map(t => {
            const c = t.id === 'all' ? all.length :
              t.id === 'draft' ? all.filter(a => a.status === 'draft').length :
              all.filter(a => (a.data as Partial<ArticleData>).categoryGroup === t.id).length;
            return (
              <div key={t.id} className={'viewtab' + (filter === t.id ? ' active' : '')} onClick={() => setFilter(t.id)}>
                {t.label}<span className="vt-count">{c}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="page-pad" style={{ paddingTop: 18 }}>
        <KbAsk articles={all} go={go} />

        <div className="kb-stats">
          <div className="kb-stat"><span className="ks-num">{published}</span><span className="ks-lab">Published</span></div>
          <div className="kb-stat"><span className="ks-num">—</span><span className="ks-lab">Total views</span></div>
          <div className="kb-stat"><span className="ks-num">—</span><span className="ks-lab">Avg. helpful</span></div>
          <div className="kb-stat"><span className="ks-num" style={{ color: 'var(--ai-text)' }}>312</span><span className="ks-lab">Deflected by Tess this month</span></div>
        </div>

        <div className="toolbar" style={{ paddingTop: 0 }}>
          <div className="tb-input">
            <Icon name="search" size={15} />
            <input placeholder="Search articles…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        <div className="kb-list">
          <div className="kb-row head">
            <div>Article</div><div>Category</div><div>Views</div><div className="h-help">Helpful</div><div>Updated</div>
          </div>
          {rows.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--muted-foreground)' }}>
              <Icon name="book" size={22} /><div style={{ marginTop: 8 }}>No articles found.</div>
            </div>
          ) : rows.map((a: KbArticleRow) => {
            const d = a.data as Partial<ArticleData>;
            const g = CATEGORY_GROUPS[d.categoryGroup ?? 'IT'] ?? CATEGORY_GROUPS.IT;
            const helpful = (d as Record<string, unknown>).helpful as number | undefined;
            const views = (d as Record<string, unknown>).views as number | undefined;
            return (
              <div className="kb-row" key={a.id} onClick={() => go('knowledge', { articleId: a.id })}>
                <div className="kb-main">
                  <span className="km-ico" style={{ background: g.color }}><Icon name="book" size={16} /></span>
                  <div style={{ minWidth: 0 }}>
                    <div className="km-title">
                      {a.title || 'Untitled'}
                      {a.status === 'draft' && <span className="pill pill-neutral" style={{ height: 18 }}><span className="dot" />Draft</span>}
                    </div>
                    <div className="km-excerpt">{d.excerpt ?? ''}</div>
                  </div>
                </div>
                <div className="kb-cat"><span className="kc-dot" style={{ background: g.color }} />{d.category ?? ''}</div>
                <div className="kb-num">{views && views > 0 ? views.toLocaleString() : '—'}</div>
                <div className="kb-help">
                  {helpful ? (
                    <>
                      <span className="kh-bar">
                        <i style={{ width: helpful + '%', background: helpful >= 80 ? 'var(--success)' : helpful >= 60 ? 'var(--warning)' : 'var(--danger)' }} />
                      </span>
                      {helpful}%
                    </>
                  ) : <span className="kb-num">—</span>}
                </div>
                <div className="kb-num" title={a.updatedAt ? absTime(new Date(a.updatedAt).getTime()) : ''}>
                  {a.updatedAt ? relTime(new Date(a.updatedAt).getTime()) : '—'}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
