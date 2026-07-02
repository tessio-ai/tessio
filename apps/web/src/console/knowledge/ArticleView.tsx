// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useState } from 'react';
import { Icon } from '../icons';
import { Button, IconButton, Popover } from '../ui';
import { useArticle, useArticles, useDeleteArticle } from './queries';
import { ProseBody } from './ArticleProse';
import { Tldr, Feedback, ArticleMeta, useScrollSpy, RelatedArticles } from './KbShared';
import { CATEGORY_GROUPS } from './kb-types';
import { RevisionHistory } from './RevisionHistory';
import type { ArticleData } from './kb-types';

type Go = (screen: string, extra?: Record<string, unknown>) => void;

export function ArticleView({ articleId, go }: { articleId: string; go: Go }) {
  const { data: article, isLoading } = useArticle(articleId);
  const allQ = useArticles({ limit: 200, sort: { field: 'updatedAt', dir: 'desc', type: 'date' } });
  const del = useDeleteArticle();
  const [confirmDel, setConfirmDel] = useState(false);
  const [history, setHistory] = useState(false);

  const d = (article?.data ?? {}) as Partial<ArticleData>;
  const sections = d.body ?? [];
  const ids = sections.map(s => s.id);
  const { active, progress, goTo } = useScrollSpy('.page', ids, [articleId]);

  useEffect(() => {
    if (!confirmDel) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setConfirmDel(false); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [confirmDel]);

  if (isLoading || !article) return <div className="page"><div className="page-pad muted">Loading…</div></div>;

  const g = CATEGORY_GROUPS[d.categoryGroup ?? 'IT'] ?? CATEGORY_GROUPS.IT;

  return (
    <div className="page">
      <div className="page-pad">
        <div className="read">
          <div className="read-main">
            <div className="read-back" onClick={() => go('knowledge')}>
              <Icon name="arrowLeft" size={15} />Knowledge Base
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
              <div style={{ minWidth: 0 }}>
                <div className="read-cat">
                  <span className="rc-dot" style={{ background: g.color }} />
                  {g.label} · {d.category ?? ''}
                </div>
                <h1 className="read-title">{article.title || 'Untitled'}</h1>
              </div>
              <div style={{ display: 'flex', gap: 8, flex: 'none' }}>
                <Button variant="outline" size="sm" icon="edit" onClick={() => go('knowledge', { articleId, view: 'edit' })}>Edit</Button>
                <Popover align="right" width={190} trigger={<IconButton name="more" title="More" />}>
                  {(close: () => void) => (
                    <div className="menu">
                      <div className="menu-item" onClick={() => close()}><Icon name="link" size={15} />Copy public link</div>
                      <div className="menu-item" onClick={() => { go('knowledge', { articleId, view: 'preview' }); close(); }}><Icon name="user" size={15} />View as requester</div>
                      <div className="menu-div" />
                      <div className="menu-item" onClick={() => setHistory(true)}><Icon name="refresh" size={15} />Version history</div>
                      <div className="menu-div" />
                      <div className="menu-item danger" onClick={() => { setConfirmDel(true); close(); }}><Icon name="x" size={15} />Delete</div>
                    </div>
                  )}
                </Popover>
              </div>
            </div>

            <div className="read-meta"><ArticleMeta article={article} /></div>

            {d.tldr && d.tldr.length > 0 && <Tldr points={d.tldr} />}

            <ProseBody sections={sections} />

            <Feedback />

            <RelatedArticles ids={d.relatedArticles ?? []} articles={allQ.data?.rows ?? []} go={go} />

            <div className="open-ticket">
              <span className="ot-ico"><Icon name="ticket" size={19} /></span>
              <div style={{ flex: 1 }}>
                <div className="ot-title">Didn't solve it?</div>
                <div className="ot-sub">Open a ticket and the right team will pick it up.</div>
              </div>
              <Button variant="primary" size="sm" icon="plus" onClick={() => go('tickets', { create: true })}>Open a ticket</Button>
            </div>
          </div>

          <aside className="toc">
            <div className="toc-label">On this page</div>
            <ul className="toc-list">
              {sections.map(s => (
                <li key={s.id} className={'toc-item' + (active === s.id ? ' active' : '')} onClick={() => goTo(s.id)}>{s.heading}</li>
              ))}
            </ul>
            <div className="toc-progress">
              <div className="tp-bar"><i style={{ width: Math.round(progress * 100) + '%' }} /></div>
              {Math.round(progress * 100)}%
            </div>
          </aside>
        </div>
      </div>

      {confirmDel && (
        <>
          <div className="scrim" onClick={() => setConfirmDel(false)} />
          <div className="dialog" role="dialog" aria-modal="true" aria-label="Delete article">
            <h3 className="dialog-title">Delete this article?</h3>
            <p className="muted">This can't be undone from here.</p>
            <div className="dialog-actions">
              <button className="btn btn-secondary btn-sm" autoFocus onClick={() => setConfirmDel(false)}>Cancel</button>
              <button className="btn btn-danger btn-sm" disabled={del.isPending} onClick={() => { setConfirmDel(false); del.mutate(article.id, { onSuccess: () => go('knowledge') }); }}>Delete article</button>
            </div>
          </div>
        </>
      )}
      {history && <RevisionHistory articleId={articleId} currentVersion={article.contentVersion ?? 1} onClose={() => setHistory(false)} onRestored={() => {}} />}
    </div>
  );
}
