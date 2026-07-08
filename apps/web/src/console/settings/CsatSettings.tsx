// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useState } from 'react';
import { Button } from '../ui';
import { DEFAULT_CSAT_QUESTION } from '@tessio/shared';
import { useCsatSettings, useUpdateCsatSettings } from './queries';

interface Draft {
  enabled: boolean;
  question: string;
}

export function CsatSettings() {
  const { data } = useCsatSettings();
  const update = useUpdateCsatSettings();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saveResult, setSaveResult] = useState<string | null>(null);

  useEffect(() => {
    if (data && !draft) setDraft({ enabled: data.enabled, question: data.question ?? '' });
  }, [data, draft]);

  if (!draft || !data) return <div className="page-pad muted">Loading…</div>;

  const onSave = () => {
    setSaveResult(null);
    update.mutate({ enabled: draft.enabled, question: draft.question.trim() }, {
      onSuccess: () => setSaveResult('Saved'),
      onError: (e) => setSaveResult(`Save failed: ${(e as Error).message}`),
    });
  };

  return (
    <>
      <h1 className="set-h">Satisfaction</h1>
      <p className="set-h-desc">Ask requesters to rate their experience after a ticket is resolved or closed.</p>

      <div className="set-card">
        <div className="set-card-head">
          <div className="set-card-title">Satisfaction surveys (CSAT)</div>
          <div className="set-card-sub">
            When a ticket moves to resolved or closed, the requester is emailed a 1–5 rating link and can also
            rate from the portal's "My requests" page. Each ticket is only surveyed once.
          </div>
        </div>
        <div className="set-card-body">
          <div className="set-row">
            <div>
              <div className="sr-label">Enable surveys</div>
              <div className="sr-hint">Survey emails also require outbound email to be configured and enabled.</div>
            </div>
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
              style={{ width: 18, height: 18, cursor: 'pointer' }}
            />
          </div>

          <div className="set-row">
            <div>
              <div className="sr-label">Survey question</div>
              <div className="sr-hint">Shown in the survey email and the portal. Leave blank to use the default.</div>
            </div>
            <input
              className="input"
              value={draft.question}
              maxLength={300}
              onChange={(e) => setDraft({ ...draft, question: e.target.value })}
              placeholder={DEFAULT_CSAT_QUESTION}
              style={{ maxWidth: 420 }}
            />
          </div>
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
