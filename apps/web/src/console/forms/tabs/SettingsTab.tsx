// SPDX-License-Identifier: AGPL-3.0-only

import { useState } from 'react';
import { Button } from '../../ui';

export interface SettingsValues { name: string; key: string; categoryKey: string; icon: string | null }

function toKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

export function SettingsTab({ values, categories, onChange, onArchive, error }: {
  values: SettingsValues;
  categories: { key: string; label: string }[];
  onChange: (v: SettingsValues) => void;
  onArchive: () => void;
  error?: string;
}) {
  const [keyManual, setKeyManual] = useState(false);
  const set = (patch: Partial<SettingsValues>) => onChange({ ...values, ...patch });
  const setName = (name: string) => {
    const patch: Partial<SettingsValues> = { name };
    if (!keyManual) patch.key = toKey(name);
    onChange({ ...values, ...patch });
  };
  return (
    <div className="settings-tab">
      {error && <div className="danger inline-error">{error}</div>}
      <div className="field"><label className="field-label" htmlFor="s_name">Name</label>
        <input id="s_name" className="input" value={values.name} onChange={(e) => setName(e.target.value)} /></div>
      <div className="field"><label className="field-label" htmlFor="s_key">Key</label>
        <input id="s_key" className="input mono" value={values.key} onChange={(e) => { setKeyManual(true); set({ key: e.target.value }); }} />
        <div className="field-hint">Auto-derived from name. Edit to override.</div></div>
      <div className="field"><label className="field-label" htmlFor="s_cat">Category</label>
        <select id="s_cat" className="select" value={values.categoryKey} onChange={(e) => set({ categoryKey: e.target.value })}>
          {categories.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          {!categories.some((c) => c.key === values.categoryKey) && <option value={values.categoryKey}>{values.categoryKey}</option>}
        </select></div>
      <div className="field"><label className="field-label" htmlFor="s_icon">Icon</label>
        <input id="s_icon" className="input" value={values.icon ?? ''} onChange={(e) => set({ icon: e.target.value })} /></div>
      <div style={{ marginTop: 16 }}>
        <Button variant="outline" size="sm" icon="x" onClick={onArchive}>Archive form</Button>
      </div>
    </div>
  );
}
