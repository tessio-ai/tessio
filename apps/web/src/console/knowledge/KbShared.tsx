// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useState } from 'react';
import { Icon } from '../icons';
import { Orb } from '../agent';
import { useBot } from '../bot';
import { Avatar, relTime } from '../ui';
import { CATEGORY_GROUPS } from './kb-types';
import { sanitizeHtml } from './sanitize';
import type { KbArticleRow } from '../../api/types';
import type { ArticleData } from './kb-types';

/* ---- Assistant TL;DR card ---- */
export function Tldr({ points }: { points: string[] }) {
  const bot = useBot();
  return (
    <div className="tldr">
      <div className="tldr-head">
        <Orb size="sm" />
        <span className="tl-name">{bot.name} summary</span>
        <span className="ai-chip"><Icon name="sparkles" size={11} />TL;DR</span>
      </div>
      <ul>
        {points.map((p, i) => (
          <li key={i} dangerouslySetInnerHTML={{ __html: sanitizeHtml(p) }} />
        ))}
      </ul>
    </div>
  );
}

/* ---- Was this helpful? ---- */
export function Feedback({ light }: { light?: boolean }) {
  const [vote, setVote] = useState<string | null>(null);
  const style = light ? { background: '#f6f7f9', borderColor: '#e8e9ee' } : undefined;
  if (vote) {
    return (
      <div className="feedback" style={style}>
        <span className="fb-q">
          {vote === 'yes' ? 'Glad it helped!' : "Thanks — we'll improve this article."}
        </span>
        <span className="fb-thanks">
          <Icon name="check" size={14} />Feedback recorded
        </span>
      </div>
    );
  }
  return (
    <div className="feedback" style={style}>
      <span className="fb-q">Was this article helpful?</span>
      <div className="fb-btns">
        <button className="fb-btn" onClick={() => setVote('yes')}>
          <Icon name="thumbsUp" size={15} />Yes
        </button>
        <button className="fb-btn" onClick={() => setVote('no')}>
          <Icon name="thumbsDown" size={15} />No
        </button>
      </div>
    </div>
  );
}

/* ---- Article metadata row ---- */
export function ArticleMeta({ article }: { article: KbArticleRow }) {
  const d = article.data as Partial<ArticleData>;
  const views = (d as Record<string, unknown>).views as number | undefined;
  return (
    <>
      <span className="rm-i">
        <Avatar user={article.authorId} size="sm" />
      </span>
      <span className="rm-sep" />
      <span className="rm-i">
        <Icon name="clock" size={14} />
        Updated {relTime(new Date(article.updatedAt).getTime())}
      </span>
      {views != null && views > 0 && (
        <>
          <span className="rm-sep" />
          <span className="rm-i">
            <Icon name="user" size={14} />{views.toLocaleString()} views
          </span>
        </>
      )}
      {d.readMin != null && (
        <>
          <span className="rm-sep" />
          <span className="rm-i">
            <Icon name="book" size={14} />{d.readMin} min read
          </span>
        </>
      )}
    </>
  );
}

/* ---- Scroll spy for TOC ---- */
export function useScrollSpy(containerSel: string, ids: string[], deps: unknown[]) {
  const [active, setActive] = useState(ids[0] ?? '');
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const container = document.querySelector(containerSel);
    if (!container) return;
    const onScroll = () => {
      const top = container.scrollTop;
      const ch = container.clientHeight;
      const sh = container.scrollHeight;
      setProgress(sh <= ch ? 1 : Math.min(1, top / (sh - ch)));
      const cTop = container.getBoundingClientRect().top;
      let cur = ids[0] ?? '';
      for (const id of ids) {
        const el = document.getElementById('sec-' + id);
        if (el && el.getBoundingClientRect().top - cTop <= 96) cur = id;
      }
      setActive(cur);
    };
    onScroll();
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, deps);
  const goTo = (id: string) => {
    const container = document.querySelector(containerSel);
    const el = document.getElementById('sec-' + id);
    if (container && el) {
      const delta = el.getBoundingClientRect().top - container.getBoundingClientRect().top;
      container.scrollTo({ top: container.scrollTop + delta - 16, behavior: 'smooth' });
    }
  };
  return { active, progress, goTo };
}

/* ---- Related articles grid ---- */
export function RelatedArticles({
  ids,
  articles,
  go,
}: {
  ids: string[];
  articles: KbArticleRow[];
  go: (screen: string, extra?: Record<string, unknown>) => void;
}) {
  const list = ids
    .map((id) => articles.find((a) => a.id === id))
    .filter((a): a is KbArticleRow => !!a);
  if (list.length === 0) return null;
  return (
    <>
      <div className="related-head">Related articles</div>
      <div className="related-grid">
        {list.map((a) => {
          const d = a.data as Partial<ArticleData>;
          const g = CATEGORY_GROUPS[d.categoryGroup ?? 'IT'] ?? CATEGORY_GROUPS.IT;
          return (
            <div
              className="related-card"
              key={a.id}
              onClick={() => go('knowledge', { articleId: a.id })}
            >
              <span className="rl-ico" style={{ background: g.color }}>
                <Icon name="book" size={15} />
              </span>
              <div style={{ minWidth: 0 }}>
                <div className="rl-title">{a.title}</div>
                <div className="rl-sub">{d.readMin ?? '?'} min · {d.category ?? ''}</div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
