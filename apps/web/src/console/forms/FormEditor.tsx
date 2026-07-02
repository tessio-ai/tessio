// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useState } from 'react';
import { Button, IconButton, StatusPill } from '../ui';
import type { Route } from '../shell';
import type { FormDefinition, PortalTheme } from '@tessio/shared';
import { useForm, useSchema, useUpdateForm, useArchiveForm, usePortalSettings } from './queries';
import { FieldsTab } from './tabs/FieldsTab';
import { LayoutTab } from './tabs/LayoutTab';
import { ThemeTab } from './tabs/ThemeTab';
import { SettingsTab, type SettingsValues } from './tabs/SettingsTab';

type Go = (screen: string, extra?: Partial<Route>) => void;
const TABS = ['fields', 'layout', 'theme', 'settings'] as const;
type Tab = (typeof TABS)[number];

export function FormEditor({ formId, go }: { formId: string; go: Go }) {
  const { data: form, isLoading } = useForm(formId);
  const { data: schema } = useSchema(form?.targetSchemaId);
  const update = useUpdateForm(formId);
  const archive = useArchiveForm();
  const [tab, setTab] = useState<Tab>('fields');

  const { data: portal } = usePortalSettings();
  const categoryList = portal && portal.categories.length
    ? portal.categories.map((c) => ({ key: c.key, label: c.label }))
    : [{ key: 'IT', label: 'IT' }, { key: 'HR', label: 'HR' }, { key: 'FAC', label: 'Facilities' }];

  const [definition, setDefinition] = useState<FormDefinition | null>(null);
  const [theme, setTheme] = useState<PortalTheme | null>(null);
  const [settings, setSettings] = useState<SettingsValues | null>(null);
  useEffect(() => {
    if (form) {
      setDefinition(form.definition);
      setTheme(form.theme);
      setSettings({ name: form.name, key: form.key, categoryKey: form.categoryKey, icon: form.icon });
    }
  }, [form]);

  if (isLoading || !form || !schema || !definition || !theme || !settings) {
    return <div className="page"><div className="page-pad muted">Loading…</div></div>;
  }

  const dirty =
    JSON.stringify(definition) !== JSON.stringify(form.definition) ||
    JSON.stringify(theme) !== JSON.stringify(form.theme) ||
    settings.name !== form.name || settings.key !== form.key || settings.categoryKey !== form.categoryKey || settings.icon !== form.icon;

  const err = update.error as { detail?: string } | null;

  const localPatch = () => ({ definition, theme, name: settings.name, key: settings.key, categoryKey: settings.categoryKey, icon: settings.icon ?? undefined });
  const save = () => update.mutate(localPatch());
  // Publish/unpublish also persists any pending local edits, so they aren't lost on the refetch.
  const togglePublish = () => update.mutate({ ...localPatch(), status: form.status === 'published' ? 'draft' : 'published' });

  return (
    <div className="page form-editor">
      <div className="page-header fe-header">
        <IconButton name="arrowLeft" title="Back to forms" onClick={() => go('forms')} />
        <h1 className="ph-title">{form.name}</h1>
        <StatusPill status={form.status} />
        <span style={{ flex: 1 }} />
        <Button variant="outline" size="sm" onClick={save} disabled={!dirty || update.isPending}>{dirty ? 'Save' : 'Saved'}</Button>
        <Button variant="primary" size="sm" onClick={togglePublish} disabled={update.isPending}>{form.status === 'published' ? 'Unpublish' : 'Publish'}</Button>
      </div>

      <div className="fe-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={'fe-tab' + (tab === t ? ' active' : '')} onClick={() => setTab(t)}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div className="page-pad">
        {err?.detail && <div className="danger inline-error">{err.detail}</div>}
        {tab === 'fields' && <FieldsTab schemaId={schema.id} definition={schema.definition} />}
        {tab === 'layout' && <LayoutTab definition={definition} schemaDefinition={schema.definition} onChange={setDefinition} />}
        {tab === 'theme' && <ThemeTab theme={theme} onChange={setTheme} />}
        {tab === 'settings' && (
          <SettingsTab
            values={settings}
            categories={categoryList.some((c) => c.key === settings.categoryKey) ? categoryList : [{ key: settings.categoryKey, label: settings.categoryKey }, ...categoryList]}
            onChange={setSettings}
            onArchive={() => archive.mutate(formId, { onSuccess: () => go('forms') })}
          />
        )}
      </div>
    </div>
  );
}
