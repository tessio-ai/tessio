// SPDX-License-Identifier: AGPL-3.0-only

import { Icon } from '../icons';
import { usePublicArticle } from './queries';
import { ProseBody } from '../knowledge/ArticleProse';
import { Tldr, Feedback } from '../knowledge/KbShared';
import { CATEGORY_GROUPS } from '../knowledge/kb-types';
import { relTime } from '../ui';

export function PortalArticle({ id, onBack, onOpenForm }: { id: string; onBack: () => void; onOpenForm: (formKey: string) => void }) {
  const { data: article, isLoading, isError } = usePublicArticle(id);
  if (isLoading) return <div className="rp-body"><div className="portal-inner muted">Loading…</div></div>;
  if (isError || !article) return <div className="rp-body"><div className="portal-inner danger">Couldn't load this article. <button className="ps-btn" onClick={onBack}>Back</button></div></div>;

  const g = CATEGORY_GROUPS[article.categoryGroup] ?? CATEGORY_GROUPS.IT;

  return (
    <div className="rp-body" style={{ '--pa': '#4f46e5' } as React.CSSProperties}>
      <div className="pread">
        <div className="pread-back" onClick={onBack}><Icon name="arrowLeft" size={15} />All articles</div>
        <div className="pread-cat">{g.label} · {article.category}</div>
        <h1 className="pread-title">{article.title}</h1>
        <div className="pread-meta">
          <span>Updated {relTime(new Date(article.updatedAt).getTime())}</span>
          <span>·</span>
          <span>{article.readMin} min read</span>
        </div>

        {article.tldr && article.tldr.length > 0 && <Tldr points={article.tldr} />}
        <ProseBody sections={article.body} />

        <div className="pread-foot">
          <Feedback light />

          <div className="open-ticket" style={{ background: '#fff', borderColor: '#eceef2', marginTop: 20 }}>
            <span className="ot-ico" style={{ background: '#eef0fe', color: '#4f46e5' }}><Icon name="ticket" size={19} /></span>
            <div style={{ flex: 1 }}>
              <div className="ot-title" style={{ color: '#16181d' }}>Still need help?</div>
              <div className="ot-sub">Submit a request and we'll take it from here.</div>
            </div>
            <button className="ps-btn primary" style={{ '--pa': '#4f46e5' } as React.CSSProperties} onClick={() => onOpenForm(article.linkedForm)}>Submit a request</button>
          </div>
        </div>
      </div>
    </div>
  );
}
