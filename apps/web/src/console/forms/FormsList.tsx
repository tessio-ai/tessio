// SPDX-License-Identifier: AGPL-3.0-only

import { useState } from 'react';
import { Button, EmptyState, StatusPill } from '../ui';
import type { Route } from '../shell';
import type { PortalTheme } from '@tessio/shared';
import { useForms, useCreateForm, useCreateSchema, usePortalSettings } from './queries';

type Go = (screen: string, extra?: Partial<Route>) => void;

const DEFAULT_THEME: PortalTheme = { accent: '#4f46e5', layout: 'single', bg: 'plain', font: 'sans', showTess: true, headline: 'New request', intro: '', success: 'Thanks — your request was received.' };

export function FormsList({ go }: { go: Go }) {
  const { data: forms, isLoading, isError } = useForms();
  const { data: portal } = usePortalSettings();
  const createSchema = useCreateSchema();
  const createForm = useCreateForm();
  const busy = createSchema.isPending || createForm.isPending;
  const catLabel = (key: string) => portal?.categories.find((c) => c.key === key)?.label ?? key;
  const [createError, setCreateError] = useState<string | null>(null);

  async function onNew() {
    setCreateError(null);
    const name = 'New form';
    const suffix = Math.random().toString(36).slice(2, 6);
    const key = `new_form_${suffix}`;
    try {
      const schema = await createSchema.mutateAsync({ name, key });
      const form = await createForm.mutateAsync({
        key,
        name,
        categoryKey: portal && portal.categories.length ? portal.categories[0].key : 'IT',
        targetSchemaId: schema.id,
        theme: DEFAULT_THEME,
        definition: { sections: [{ id: 'sec_main', title: 'Details', order: 0, fields: [{ fieldKey: 'title', width: 'full' }] }] },
      });
      go('forms', { formId: form.id });
    } catch (err) {
      const e = err as { detail?: string; message?: string };
      setCreateError(e.detail ?? e.message ?? 'Could not create the form. Please try again.');
    }
  }

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="ph-title">Forms</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="outline" icon="settings" onClick={() => go('forms', { view: 'homepage' })}>Edit homepage</Button>
          <Button variant="primary" icon="plus" onClick={onNew} disabled={busy}>{busy ? 'Creating…' : 'New form'}</Button>
        </div>
      </div>
      <div className="page-pad">
        {createError && <div className="danger inline-error" role="alert">{createError}</div>}
        {isLoading && <p className="muted">Loading…</p>}
        {isError && <p className="danger">Failed to load forms.</p>}
        {forms && forms.length === 0 && (
          <div className="card" style={{ borderStyle: 'dashed' }}>
            <EmptyState icon="form" title="No forms yet" body="Create a form to collect requests from your portal." />
          </div>
        )}
        {forms && forms.length > 0 && (
          <table className="tbl">
            <thead><tr><th>Name</th><th>Category</th><th>Status</th><th>Updated</th></tr></thead>
            <tbody>
              {forms.map((f) => (
                <tr key={f.id} className="row-clickable" onClick={() => go('forms', { formId: f.id })}>
                  <td>{f.name}</td>
                  <td>{catLabel(f.categoryKey)}</td>
                  <td><StatusPill status={f.status} /></td>
                  <td className="muted">{new Date(f.updatedAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
