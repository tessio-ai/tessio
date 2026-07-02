// SPDX-License-Identifier: AGPL-3.0-only

import { useMemo, useState } from 'react';
import { Icon } from '../icons';
import { usePublicArticles } from './queries';
import { CATEGORY_GROUPS } from '../knowledge/kb-types';

export function PortalKnowledge({ onOpen, onBack }: { onOpen: (id: string) => void; onBack: () => void }) {
  const [q, setQ] = useState('');
  const { data, isLoading } = usePublicArticles();
  const all = data ?? [];
  const list = useMemo(() =>
    q ? all.filter(a => (a.title + ' ' + a.excerpt).toLowerCase().includes(q.toLowerCase())) : all
  , [all, q]);
  const groups = ['IT', 'HR', 'FAC'] as const;

  return (
    <div className="rp-body">
      <div className="pkb-hero">
        <div className="pread-back" onClick={onBack}><Icon name="arrowLeft" size={15} />Back to help center</div>
        <h1 className="pkb-h">Knowledge base</h1>
        <p className="pkb-sub">Answers to common questions — most issues are solved here in a minute.</p>
        <div className="rp-search" style={{ marginTop: 22 }}>
          <Icon name="search" size={19} className="rs-ico" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search the knowledge base…" />
        </div>
      </div>
      <div className="pkb-cats">
        {isLoading ? (
          <div style={{ textAlign: 'center', color: '#7a8089', padding: '40px 0' }}>Loading…</div>
        ) : (
          <>
            {groups.map(gk => {
              const items = list.filter(a => a.categoryGroup === gk);
              if (!items.length) return null;
              const g = CATEGORY_GROUPS[gk];
              return (
                <div key={gk}>
                  <div className="pkb-catrow">
                    <span className="pc-ico" style={{ background: g.color }}><Icon name={g.icon} size={15} /></span>
                    <span className="pc-name">{g.label}</span>
                  </div>
                  <div className="pkb-grid">
                    {items.map(a => (
                      <div className="pkb-card" key={a.id} onClick={() => onOpen(a.id)}>
                        <div className="pk-title">{a.title}</div>
                        <div className="pk-excerpt">{a.excerpt}</div>
                        <div className="pk-meta"><Icon name="book" size={12} />{a.readMin} min read · {a.category}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {list.length === 0 && (
              <div style={{ textAlign: 'center', color: '#7a8089', padding: '40px 0' }}>
                {q ? `No articles match "${q}".` : 'No articles available.'}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
