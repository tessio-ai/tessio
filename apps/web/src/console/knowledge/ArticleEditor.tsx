// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useRef, useState } from 'react';
import { Icon } from '../icons';
import { Orb } from '../agent';
import { useBot } from '../bot';
import { Button } from '../ui';
import { useArticle, useKbSchemas, useCreateArticle, useUpdateArticle } from './queries';
import { CATEGORY_GROUPS } from './kb-types';
import { slugify } from './slugify';
import { useAuth } from '../../auth/AuthContext';
import { sanitizeHtml } from './sanitize';
import { streamKbDraft } from '../../api/ai';
import type { ArticleSection, ArticleData } from './kb-types';

type Go = (screen: string, extra?: Record<string, unknown>) => void;

function bodyToHtml(sections: ArticleSection[]): string {
  return sections.map(sec => {
    let h = `<h2>${sec.heading}</h2>`;
    sec.blocks.forEach(b => {
      if (b.t === 'p') h += `<p>${b.html}</p>`;
      else if (b.t === 'steps') h += `<ol>${b.items.map(i => `<li>${i}</li>`).join('')}</ol>`;
      else if (b.t === 'list') h += `<ul>${b.items.map(i => `<li>${i}</li>`).join('')}</ul>`;
      else if (b.t === 'note') h += `<p><b>${b.kind === 'warn' ? '⚠ Note:' : b.kind === 'tip' ? '💡 Tip:' : 'ℹ Info:'}</b> ${b.html}</p>`;
    });
    return h;
  }).join('');
}

function htmlToSections(html: string): ArticleSection[] {
  const div = document.createElement('div');
  div.innerHTML = html;
  const sections: ArticleSection[] = [];
  let current: ArticleSection | null = null;
  for (const node of Array.from(div.childNodes)) {
    if (node instanceof HTMLHeadingElement && node.tagName === 'H2') {
      if (current) sections.push(current);
      current = { id: slugify(node.textContent ?? ''), heading: node.textContent ?? '', blocks: [] };
    } else if (current) {
      if (node instanceof HTMLOListElement) {
        current.blocks.push({ t: 'steps', items: Array.from(node.querySelectorAll('li')).map(li => li.innerHTML) });
      } else if (node instanceof HTMLUListElement) {
        current.blocks.push({ t: 'list', items: Array.from(node.querySelectorAll('li')).map(li => li.innerHTML) });
      } else if (node instanceof HTMLElement) {
        const text = node.innerHTML?.trim();
        if (text) current.blocks.push({ t: 'p', html: text });
      }
    } else {
      if (!current) current = { id: 'intro', heading: 'Introduction', blocks: [] };
      if (node instanceof HTMLElement) {
        const text = node.innerHTML?.trim();
        if (text) current.blocks.push({ t: 'p', html: text });
      }
    }
  }
  if (current) sections.push(current);
  return sections;
}

/** Defensive: models are told not to fence, but strip a stray ```html … ``` wrapper if one slips in. */
function stripCodeFences(s: string): string {
  const t = s.trim();
  if (!t.startsWith('```')) return s;
  return t.replace(/^```[a-zA-Z]*\n?/, '').replace(/```\s*$/, '');
}

export function ArticleEditor({ articleId, go }: { articleId?: string; go: Go }) {
  const bot = useBot();
  const { user } = useAuth();
  const { data: schemas } = useKbSchemas();
  const editing = !!articleId;
  const existing = useArticle(articleId ?? null);
  const create = useCreateArticle();
  const update = useUpdateArticle(articleId ?? '');

  const bodyRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [group, setGroup] = useState('IT');
  const [cat, setCat] = useState('');
  const [linkedForm, setLinkedForm] = useState('report_incident');
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [bodyEmpty, setBodyEmpty] = useState(true);
  const draftAbortRef = useRef<AbortController | null>(null);

  useEffect(() => () => draftAbortRef.current?.abort(), []);

  useEffect(() => {
    if (editing && existing.data && !loaded) {
      const a = existing.data;
      const d = a.data as Partial<ArticleData>;
      setTitle(a.title ?? '');
      setExcerpt(d.excerpt ?? '');
      setStatus(a.status ?? 'draft');
      setGroup(d.categoryGroup ?? 'IT');
      setCat(d.category ?? '');
      setLinkedForm(d.linkedForm ?? 'report_incident');
      if (bodyRef.current && d.body) {
        // Stored article HTML is authored content; sanitize before it re-enters the
        // live (contentEditable) DOM so an <img onerror=…>-style payload saved by a
        // lower-trust author can't execute in this editor's session.
        bodyRef.current.innerHTML = sanitizeHtml(bodyToHtml(d.body));
        setBodyEmpty(!bodyRef.current.textContent?.trim());
      }
      setLoaded(true);
    }
  }, [editing, existing.data, loaded]);

  const exec = (cmd: string, val?: string) => {
    document.execCommand(cmd, false, val ?? undefined);
    bodyRef.current?.focus();
  };
  const formatBlock = (tag: string) => exec('formatBlock', tag);

  const draftWithTess = () => {
    if (drafting) return;
    draftAbortRef.current?.abort();
    const ctrl = new AbortController();
    draftAbortRef.current = ctrl;
    setDraftError(null);
    setDrafting(true);
    // When editing an article with content, ask Tess to improve/expand it rather than start over.
    const existingHtml = editing ? (bodyRef.current?.innerHTML ?? '').trim() : '';
    let acc = '';
    streamKbDraft(
      {
        title: title || undefined,
        category: cat || undefined,
        categoryGroup: group || undefined,
        existingHtml: existingHtml || undefined,
      },
      (chunk) => {
        acc += chunk;
        if (bodyRef.current) {
          // Sanitize on every delta: the draft flows straight into the live (contentEditable)
          // DOM, so a model-emitted <img onerror=…> must never execute here.
          bodyRef.current.innerHTML = sanitizeHtml(stripCodeFences(acc));
          setBodyEmpty(!bodyRef.current.textContent?.trim());
        }
      },
      ctrl.signal,
    )
      .then(() => {
        if (!title) setTitle('How to ' + (cat ? cat.toLowerCase() + ' — quick guide' : 'resolve this issue'));
        if (!excerpt) setExcerpt('A short, friendly guide covering the common causes and the fastest fix.');
      })
      .catch((e) => {
        if ((e as Error)?.name === 'AbortError') return;
        setDraftError(`Couldn't reach ${bot.name}. Check that Tess AI is enabled in Settings.`);
      })
      .finally(() => {
        if (draftAbortRef.current === ctrl) setDrafting(false);
      });
  };

  const save = () => {
    const schema = schemas?.[0];
    if (!schema) return;
    const sections = htmlToSections(bodyRef.current?.innerHTML ?? '');
    const wordCount = sections.reduce((n, s) => n + s.blocks.reduce((m, b) => {
      if (b.t === 'p' || b.t === 'note') return m + (b.html?.split(/\s+/).length ?? 0);
      if (b.t === 'steps' || b.t === 'list') return m + b.items.reduce((x, i) => x + i.split(/\s+/).length, 0);
      return m;
    }, 0), 0);
    const data: ArticleData = {
      body: sections,
      excerpt,
      tldr: [],
      categoryGroup: group as 'IT' | 'HR' | 'FAC',
      category: cat,
      relatedArticles: [],
      linkedForm,
      readMin: Math.max(1, Math.round(wordCount / 200)),
      tags: [],
    };
    const common = {
      title,
      slug: slugify(title),
      status,
      data: data as unknown as Record<string, unknown>,
      ...(status === 'published' ? { publishedAt: new Date().toISOString() } : {}),
      ...(user?.id ? { authorId: user.id } : {}),
    };
    if (editing) {
      update.mutate(common, { onSuccess: () => go('knowledge', { articleId }) });
    } else {
      create.mutate(
        { schemaId: schema.id, schemaVersion: schema.version, ...common },
        { onSuccess: (row) => go('knowledge', { articleId: row.id }) },
      );
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--border)', flex: 'none' }}>
        <div className="read-back" style={{ whiteSpace: 'nowrap' }} onClick={() => go('knowledge', editing ? { articleId } : {})}>
          <Icon name="arrowLeft" size={15} />{editing ? 'Back to article' : 'Knowledge Base'}
        </div>
        <span className="badge"><Icon name="edit" size={12} />{editing ? 'Editing' : 'New article'}</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 'var(--t-caption)', color: 'var(--faint-foreground)', whiteSpace: 'nowrap' }}>Draft autosaved</span>
        <Button variant="ghost" size="sm" onClick={() => go('knowledge', editing ? { articleId } : {})}>Cancel</Button>
        <Button variant="primary" size="sm" icon="check" onClick={save}>{status === 'published' ? 'Publish' : 'Save draft'}</Button>
      </div>

      <div className="editor">
        <div className="ed-canvas">
          <div className="ed-inner">
            <div className="ed-toolbar">
              <div className="ed-tool" title="Bold" onMouseDown={e => { e.preventDefault(); exec('bold'); }} style={{ fontWeight: 800 }}>B</div>
              <div className="ed-tool" title="Italic" onMouseDown={e => { e.preventDefault(); exec('italic'); }} style={{ fontStyle: 'italic', fontWeight: 600 }}>I</div>
              <div className="ed-tdiv" />
              <div className="ed-tool wide" title="Heading" onMouseDown={e => { e.preventDefault(); formatBlock('<h2>'); }}>Heading</div>
              <div className="ed-tool wide" title="Body" onMouseDown={e => { e.preventDefault(); formatBlock('<p>'); }}>Body</div>
              <div className="ed-tdiv" />
              <div className="ed-tool" title="Numbered list" onMouseDown={e => { e.preventDefault(); exec('insertOrderedList'); }}><Icon name="checkCheck" size={15} /></div>
              <div className="ed-tool" title="Bulleted list" onMouseDown={e => { e.preventDefault(); exec('insertUnorderedList'); }}><Icon name="sliders" size={15} /></div>
              <div className="ed-tool" title="Link" onMouseDown={e => { e.preventDefault(); exec('createLink', 'https://'); }}><Icon name="link" size={15} /></div>
              <div style={{ flex: 1 }} />
              <div className="ed-tool wide" title={`Improve with ${bot.name}`} onMouseDown={e => { e.preventDefault(); draftWithTess(); }} style={{ color: 'var(--ai-text)' }}>
                <Icon name="sparkles" size={14} />{bot.name}
              </div>
            </div>

            <input className="ed-title" value={title} onChange={e => setTitle(e.target.value)} placeholder="Article title" />
            <textarea className="ed-excerpt" rows={2} value={excerpt} onChange={e => setExcerpt(e.target.value)} placeholder="One-line summary shown in search and lists…" />
            {drafting && (
              <div style={{ padding: '14px 0', display: 'flex', alignItems: 'center', gap: 10, color: 'var(--ai-text)' }}>
                <Orb size="md" thinking /> <span className="ask-typing"><i /><i /><i /></span> <span style={{ fontSize: 'var(--t-small)', color: 'var(--muted-foreground)' }}>{bot.name} is drafting…</span>
              </div>
            )}
            {draftError && (
              <div style={{ padding: '10px 0', fontSize: 'var(--t-small)', color: 'var(--danger, #dc2626)' }}>{draftError}</div>
            )}
            <div className="ed-body prose" ref={bodyRef} contentEditable={!drafting} suppressContentEditableWarning
              onInput={() => setBodyEmpty(!bodyRef.current?.textContent?.trim())}
              data-empty={bodyEmpty && !drafting ? `Start writing, or let ${bot.name} draft a first version →` : undefined} />
          </div>
        </div>

        <aside className="ed-side">
          <div className="ed-sect">Status</div>
          <div className="seg" style={{ width: '100%' }}>
            <button className={status === 'draft' ? 'active' : ''} style={{ flex: 1 }} onClick={() => setStatus('draft')}>Draft</button>
            <button className={status === 'published' ? 'active' : ''} style={{ flex: 1 }} onClick={() => setStatus('published')}>Published</button>
          </div>

          <div className="ed-sect">Category</div>
          <div className="ed-field">
            <label>Group</label>
            <select className="select" value={group} onChange={e => setGroup(e.target.value)}>
              {Object.entries(CATEGORY_GROUPS).map(([k, g]) => <option key={k} value={k}>{g.label}</option>)}
            </select>
          </div>
          <div className="ed-field">
            <label>Topic</label>
            <input className="input" value={cat} onChange={e => setCat(e.target.value)} placeholder="e.g. Hardware, Access…" />
          </div>

          <div className="ed-sect">Assist</div>
          <div className="ed-draft">
            <div className="edt-head"><Orb size="sm" />Draft with {bot.name}</div>
            <div className="edt-sub">Generate a structured first draft from the title and topic, then edit it yourself.</div>
            <button className="ai-btn solid" style={{ width: '100%', justifyContent: 'center' }} onClick={draftWithTess} disabled={drafting}>
              <Icon name="wand" size={14} />{drafting ? 'Drafting…' : editing ? 'Improve & expand' : 'Draft this article'}
            </button>
          </div>

          <div className="ed-sect">Linked request</div>
          <div className="ed-field">
            <label>"Open a ticket" form</label>
            <select className="select" value={linkedForm} onChange={e => setLinkedForm(e.target.value)}>
              <option value="report_incident">Report an incident</option>
              <option value="general_request">General request</option>
            </select>
          </div>
        </aside>
      </div>
    </div>
  );
}
