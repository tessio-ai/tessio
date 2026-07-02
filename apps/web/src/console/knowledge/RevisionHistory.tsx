// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useState } from 'react';
import { Icon } from '../icons';
import { useRevisions, useRevision, useRestoreRevision, useUsers } from './queries';
import { ProseBody } from './ArticleProse';
import type { ArticleSection } from './kb-types';
import { relTime } from '../ui';

export function RevisionHistory({ articleId, currentVersion, onClose, onRestored }: { articleId: string; currentVersion: number; onClose: () => void; onRestored: () => void }) {
  const { data: revisions } = useRevisions(articleId);
  const { data: users } = useUsers();
  const [selected, setSelected] = useState<string | null>(null);
  const { data: preview } = useRevision(articleId, selected);
  const restore = useRestoreRevision(articleId);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  const author = (id: string | null) => (users ?? []).find((u) => u.id === id)?.name ?? 'Unknown';

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="drawer" role="dialog" aria-modal="true" aria-label="Version history" style={{ width: 640, maxWidth: '90vw' }}>
        <div className="drawer-head">
          <div className="drawer-title">Version history</div>
          <button className="btn-icon" onClick={onClose} aria-label="Close"><Icon name="x" size={16} /></button>
        </div>
        <div className="drawer-body" style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 0, padding: 0 }}>
          <div style={{ borderRight: '1px solid var(--border)', overflow: 'auto', padding: 8 }}>
            {(revisions ?? []).map((rev) => (
              <button key={rev.id} type="button" onClick={() => setSelected(rev.id)} className={'menu-item' + (selected === rev.id ? ' active' : '')} style={{ display: 'block', width: '100%', textAlign: 'left' }}>
                <div style={{ fontWeight: 600 }}>v{rev.version}{rev.version === currentVersion && <span className="badge" style={{ marginLeft: 6 }}>Current</span>}</div>
                <div className="muted" style={{ fontSize: 'var(--t-caption)' }}>{author(rev.authorId)}{rev.createdAt ? ` · ${relTime(new Date(rev.createdAt).getTime())}` : ''}</div>
              </button>
            ))}
          </div>
          <div style={{ padding: 16, overflow: 'auto' }}>
            {!preview ? (
              <div className="muted">Select a version to preview.</div>
            ) : (
              <>
                <div className="ph-top" style={{ marginBottom: 12 }}>
                  <h3 style={{ margin: 0 }}>{preview.title || 'Untitled'} <span className="muted">v{preview.version}</span></h3>
                  {preview.version !== currentVersion && (
                    <button className="btn btn-primary btn-sm" disabled={restore.isPending} onClick={() => restore.mutate(preview.id, { onSuccess: () => { onRestored(); onClose(); } })}>Restore this version</button>
                  )}
                </div>
                {Array.isArray(preview.data.body)
                  ? <ProseBody sections={preview.data.body as ArticleSection[]} />
                  : <div className="prose"><p>{String(preview.data.body ?? '')}</p></div>}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
