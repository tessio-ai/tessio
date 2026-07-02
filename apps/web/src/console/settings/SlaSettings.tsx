// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useState } from 'react';
import { Button } from '../ui';
import { useSlaSettings, useUpdateSlaSettings } from './queries';
import { PRIORITY_MAP } from '../data';

const PRIORITY_ORDER = ['urgent', 'high', 'medium', 'low'] as const;

interface TargetDraft {
  responseHours: string;
  resolutionHours: string;
}

interface Draft {
  enabled: boolean;
  targets: Record<string, TargetDraft>;
}

export function SlaSettings() {
  const { data } = useSlaSettings();
  const update = useUpdateSlaSettings();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saveResult, setSaveResult] = useState<string | null>(null);

  useEffect(() => {
    if (data && !draft) {
      const targets: Record<string, TargetDraft> = {};
      for (const p of PRIORITY_ORDER) {
        const t = data.targets[p];
        targets[p] = {
          responseHours: t ? String(t.responseMins / 60) : '',
          resolutionHours: t ? String(t.resolutionMins / 60) : '',
        };
      }
      setDraft({ enabled: data.enabled, targets });
    }
  }, [data, draft]);

  if (!draft || !data) return <div className="page-pad muted">Loading…</div>;

  const setEnabled = (v: boolean) => setDraft({ ...draft, enabled: v });
  const setTarget = (priority: string, field: 'responseHours' | 'resolutionHours', value: string) =>
    setDraft({ ...draft, targets: { ...draft.targets, [priority]: { ...draft.targets[priority], [field]: value } } });

  const onSave = () => {
    const targets: Record<string, { responseMins: number; resolutionMins: number }> = {};
    for (const p of PRIORITY_ORDER) {
      const t = draft.targets[p];
      const rh = parseFloat(t.responseHours);
      const sh = parseFloat(t.resolutionHours);
      if (t.responseHours.trim() !== '' && t.resolutionHours.trim() !== '' && !isNaN(rh) && !isNaN(sh)) {
        targets[p] = { responseMins: Math.round(rh * 60), resolutionMins: Math.round(sh * 60) };
      }
    }
    setSaveResult(null);
    update.mutate({ enabled: draft.enabled, targets }, {
      onSuccess: () => setSaveResult('Saved'),
      onError: (e) => setSaveResult(`Save failed: ${(e as Error).message}`),
    });
  };

  return (
    <>
      <h1 className="set-h">SLA</h1>
      <p className="set-h-desc">Configure service level agreement targets. Response and resolution timers start when a ticket is created.</p>

      <div className="set-card">
        <div className="set-card-head">
          <div className="set-card-title">SLA targets</div>
          <div className="set-card-sub">Set response and resolution time targets per priority level. Leave a row blank to omit that priority from SLA tracking.</div>
        </div>
        <div className="set-card-body">
          <div className="set-row">
            <div>
              <div className="sr-label">Enable SLA</div>
              <div className="sr-hint">Track response and resolution deadlines on tickets.</div>
            </div>
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              style={{ width: 18, height: 18, cursor: 'pointer' }}
            />
          </div>

          {PRIORITY_ORDER.map((p) => {
            const label = PRIORITY_MAP[p]?.label ?? p;
            const t = draft.targets[p];
            return (
              <div className="set-row" key={p}>
                <div>
                  <div className="sr-label">{label} priority</div>
                  <div className="sr-hint">Leave blank to skip SLA for this priority.</div>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      step="0.5"
                      placeholder="—"
                      value={t.responseHours}
                      onChange={(e) => setTarget(p, 'responseHours', e.target.value)}
                      style={{ maxWidth: 90 }}
                    />
                    <span style={{ fontSize: 'var(--t-small)', color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>h response</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      step="0.5"
                      placeholder="—"
                      value={t.resolutionHours}
                      onChange={(e) => setTarget(p, 'resolutionHours', e.target.value)}
                      style={{ maxWidth: 90 }}
                    />
                    <span style={{ fontSize: 'var(--t-small)', color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>h resolution</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="set-card-foot">
          <div style={{ flex: 1 }} />
          {saveResult && <span className="sf-note">{saveResult}</span>}
          <Button variant="primary" onClick={onSave} disabled={update.isPending}>
            {update.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </div>
    </>
  );
}
