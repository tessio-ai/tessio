// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useState } from 'react';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Button, IconButton } from '../ui';
import type { Route } from '../shell';
import type { PortalCategory, PortalHero, PortalCatalogConfig } from '@tessio/shared';
import { usePortalSettings, useUpdatePortalSettings } from './queries';
import { addCategory, removeCategory, setCategoryProps, moveCategory } from './categories-reducer';
import { CategoryRow } from './CategoryRow';
import { PortalHero as PortalHeroComponent } from '../portal/PortalHero';
import { PortalCatalogView } from '../portal/PortalCatalogView';
import { groupForms } from '../portal/grouping';
import { usePublicForms } from '../portal/queries';
import type { PortalSettingsRow } from '../../api/portal';

type Go = (screen: string, extra?: Partial<Route>) => void;

interface Local {
  brandName: string; logo: string; heroHeadline: string; heroIntro: string;
  accent: string; showTess: boolean; categories: PortalCategory[];
  hero: PortalHero; catalog: PortalCatalogConfig;
}

export function PortalEditor({ go }: { go: Go }) {
  const { data: settings, isLoading } = usePortalSettings();
  const update = useUpdatePortalSettings();
  const [local, setLocal] = useState<Local | null>(null);

  useEffect(() => {
    if (settings) {
      setLocal({
        brandName: settings.brandName, logo: settings.logo ?? '', heroHeadline: settings.heroHeadline,
        heroIntro: settings.heroIntro ?? '', accent: settings.accent, showTess: settings.showTess,
        categories: settings.categories, hero: settings.hero, catalog: settings.catalog,
      });
    }
  }, [settings]);

  const { data: previewForms } = usePublicForms();

  if (isLoading || !settings || !local) return <div className="page"><div className="page-pad muted">Loading…</div></div>;

  const draft = { orgId: '', updatedAt: '', ...local } as unknown as PortalSettingsRow;
  const { groups, orphans } = groupForms(previewForms ?? [], local.categories);

  const dirty = JSON.stringify(local) !== JSON.stringify({
    brandName: settings.brandName, logo: settings.logo ?? '', heroHeadline: settings.heroHeadline,
    heroIntro: settings.heroIntro ?? '', accent: settings.accent, showTess: settings.showTess, categories: settings.categories,
    hero: settings.hero, catalog: settings.catalog,
  });
  const err = update.error as { detail?: string } | null;
  const set = (patch: Partial<Local>) => setLocal((l) => ({ ...l!, ...patch }));
  const cats = (next: PortalCategory[]) => set({ categories: next });

  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const from = local!.categories.findIndex((c) => c.key === e.active.id);
    const to = local!.categories.findIndex((c) => c.key === e.over!.id);
    if (from < 0 || to < 0) return;
    cats(moveCategory(local!.categories, from, to));
  }

  return (
    <div className="page portal-editor">
      <div className="page-header fe-header">
        <IconButton name="arrowLeft" title="Back to forms" onClick={() => go('forms')} />
        <h1 className="ph-title">Homepage</h1>
        <span style={{ flex: 1 }} />
        <Button variant="primary" size="sm" onClick={() => update.mutate(local)} disabled={!dirty || update.isPending}>{dirty ? 'Save' : 'Saved'}</Button>
      </div>

      <div className="page-pad">
        <div className="pe-controls">
          {err?.detail && <div className="danger inline-error">{err.detail}</div>}

          <div className="card pe-section">
            <div className="label">Branding</div>
            <div className="field"><label className="field-label" htmlFor="p_brand">Brand name</label>
              <input id="p_brand" className="input" value={local.brandName} onChange={(e) => set({ brandName: e.target.value })} /></div>
            <div className="field"><label className="field-label" htmlFor="p_logo">Logo</label>
              <input id="p_logo" className="input" value={local.logo} onChange={(e) => set({ logo: e.target.value })} /></div>
            <div className="field"><label className="field-label" htmlFor="p_accent">Accent</label>
              <input id="p_accent" type="color" value={local.accent} onChange={(e) => set({ accent: e.target.value })} /></div>
          </div>

          <div className="card pe-section">
            <div className="label">Hero</div>
            <div className="field"><label className="field-label" htmlFor="p_headline">Headline</label>
              <input id="p_headline" className="input" value={local.heroHeadline} onChange={(e) => set({ heroHeadline: e.target.value })} /></div>
            <div className="field"><label className="field-label" htmlFor="p_intro">Intro</label>
              <textarea id="p_intro" className="textarea" value={local.heroIntro} onChange={(e) => set({ heroIntro: e.target.value })} /></div>
            <label className="field-check"><input type="checkbox" checked={local.showTess} onChange={(e) => set({ showTess: e.target.checked })} /> Show Tess assist</label>
          </div>

          <div className="card pe-section">
            <div className="label">Hero style</div>
            <div className="type-picker" role="radiogroup" aria-label="Hero preset">
              {(['spotlight', 'editorial', 'aurora', 'classic'] as const).map((p) => (
                <label key={p} className={'type-opt' + (local.hero.preset === p ? ' active' : '')}>
                  <input type="radio" name="preset" className="sr-only" checked={local.hero.preset === p} onChange={() => set({ hero: { ...local.hero, preset: p } })} />
                  <span className="tn" style={{ textTransform: 'capitalize' }}>{p}</span>
                </label>
              ))}
            </div>
            <div className="field"><label className="field-label" htmlFor="p_eyebrow">Eyebrow (brand chip)</label>
              <input id="p_eyebrow" className="input" value={local.hero.eyebrow ?? ''} onChange={(e) => set({ hero: { ...local.hero, eyebrow: e.target.value } })} /></div>
            <label className="field-check"><input type="checkbox" checked={local.hero.showSearch} onChange={(e) => set({ hero: { ...local.hero, showSearch: e.target.checked } })} /> Show search bar</label>
            <div className="field-hint">Wrap one word in *asterisks* in the headline to highlight it. Quick-action chips auto-fill from popular requests.</div>
          </div>

          <div className="card pe-section">
            <div className="label">Catalog layout</div>
            <div className="field"><label className="field-label">Section style</label>
              <div className="seg" role="group" aria-label="Section style">{(['band', 'plain'] as const).map((v) => <button key={v} type="button" className={local.catalog.sectionStyle === v ? 'active' : ''} onClick={() => set({ catalog: { ...local.catalog, sectionStyle: v } })}>{v}</button>)}</div></div>
            <div className="field"><label className="field-label">Card style</label>
              <div className="seg" role="group" aria-label="Card style">{(['comfortable', 'compact'] as const).map((v) => <button key={v} type="button" className={local.catalog.cardStyle === v ? 'active' : ''} onClick={() => set({ catalog: { ...local.catalog, cardStyle: v } })}>{v}</button>)}</div></div>
            <div className="field"><label className="field-label">Columns</label>
              <div className="seg" role="group" aria-label="Columns">{(['auto', 2, 3, 4] as const).map((v) => <button key={String(v)} type="button" className={local.catalog.columns === v ? 'active' : ''} onClick={() => set({ catalog: { ...local.catalog, columns: v } })}>{v}</button>)}</div></div>
          </div>

          <div className="card pe-section">
            <div className="label">Categories</div>
            <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={local.categories.map((c) => c.key)} strategy={verticalListSortingStrategy}>
                {local.categories.map((c, i) => (
                  <CategoryRow key={c.key} category={c} onChange={(patch) => cats(setCategoryProps(local.categories, i, patch))} onRemove={() => cats(removeCategory(local.categories, i))} />
                ))}
              </SortableContext>
            </DndContext>
            <Button variant="outline" size="sm" icon="plus" onClick={() => cats(addCategory(local.categories))}>Add category</Button>
          </div>
        </div>

        <div className="pe-preview" aria-label="Live preview">
          <div className="reqportal pe-preview-frame" inert>
            <PortalHeroComponent settings={draft} forms={previewForms ?? []} onOpenForm={() => {}} />
            <PortalCatalogView catalog={local.catalog} groups={groups} orphans={orphans} onOpenForm={() => {}} />
          </div>
        </div>
      </div>
    </div>
  );
}
