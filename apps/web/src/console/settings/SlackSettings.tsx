// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useState } from 'react';
import { Button } from '../ui';
import { useSlackSettings, useUpdateSlackSettings, useTestSlack } from './queries';
import type { UpdateSlackSettingsInput } from '../../api/slack';

interface Draft {
  enabled: boolean;
  webhookUrl: string;
  notifyCreated: boolean;
  notifyAssigned: boolean;
  notifyStatus: boolean;
  notifyCommented: boolean;
  notifySlaBreach: boolean;
}

const EVENT_TOGGLES: { key: keyof Draft; label: string; hint: string }[] = [
  { key: 'notifyCreated', label: 'Ticket created', hint: 'Announce every new ticket.' },
  { key: 'notifyAssigned', label: 'Assignee changed', hint: 'Post when a ticket is (re)assigned.' },
  { key: 'notifyStatus', label: 'Status changed', hint: 'Post status transitions (resolved, closed, …).' },
  { key: 'notifyCommented', label: 'New reply', hint: 'Post when a comment or internal note is added.' },
  { key: 'notifySlaBreach', label: 'SLA breach', hint: 'Post when a response or resolution SLA is breached.' },
];

export function SlackSettings() {
  const { data } = useSlackSettings();
  const update = useUpdateSlackSettings();
  const testSlack = useTestSlack();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [saveResult, setSaveResult] = useState<string | null>(null);

  useEffect(() => {
    if (data && !draft) {
      setDraft({
        enabled: data.enabled,
        webhookUrl: '',
        notifyCreated: data.notifyCreated,
        notifyAssigned: data.notifyAssigned,
        notifyStatus: data.notifyStatus,
        notifyCommented: data.notifyCommented,
        notifySlaBreach: data.notifySlaBreach,
      });
    }
  }, [data, draft]);

  if (!draft || !data) return <div className="page-pad muted">Loading…</div>;

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft({ ...draft, [k]: v });

  const onSave = () => {
    const patch: UpdateSlackSettingsInput = {
      enabled: draft.enabled,
      notifyCreated: draft.notifyCreated,
      notifyAssigned: draft.notifyAssigned,
      notifyStatus: draft.notifyStatus,
      notifyCommented: draft.notifyCommented,
      notifySlaBreach: draft.notifySlaBreach,
    };
    if (draft.webhookUrl.trim()) patch.webhookUrl = draft.webhookUrl.trim();
    setSaveResult(null);
    update.mutate(patch, {
      onSuccess: () => {
        setDraft((prev) => prev ? { ...prev, webhookUrl: '' } : null);
        setSaveResult('Saved');
      },
      onError: (e) => setSaveResult(`Save failed: ${(e as Error).message}`),
    });
  };

  const onTest = () => {
    setTestResult(null);
    testSlack.mutate(undefined, {
      onSuccess: () => setTestResult('Test message sent'),
      onError: (e) => setTestResult(`Failed: ${(e as Error).message}`),
    });
  };

  return (
    <>
      <h1 className="set-h">Slack</h1>
      <p className="set-h-desc">Post ticket activity and SLA breaches to a Slack channel via an incoming webhook. Workflows can also post custom messages with the "Slack message" step.</p>

      <div className="set-card">
        <div className="set-card-head"><div className="set-card-title">Connection</div><div className="set-card-sub">Create an incoming webhook in Slack (or any compatible chat tool) and paste its URL here.</div></div>
        <div className="set-card-body">
          <div className="set-row">
            <div><div className="sr-label">Enable Slack notifications</div><div className="sr-hint">Post the selected events to the webhook's channel.</div></div>
            <input type="checkbox" checked={draft.enabled} onChange={(e) => set('enabled', e.target.checked)} style={{ width: 18, height: 18, cursor: 'pointer' }} />
          </div>

          <div className="set-row">
            <div><div className="sr-label">Webhook URL</div><div className="sr-hint">{data.webhookConfigured ? 'Configured — leave blank to keep.' : 'Stored encrypted; never shown again.'}</div></div>
            <input
              className="input"
              type="password"
              value={draft.webhookUrl}
              placeholder={data.webhookConfigured ? '•••••••• (leave blank to keep)' : 'https://hooks.slack.com/services/…'}
              onChange={(e) => set('webhookUrl', e.target.value)}
              style={{ maxWidth: 380 }}
            />
          </div>
        </div>
        <div className="set-card-foot">
          <Button variant="outline" onClick={onTest} disabled={testSlack.isPending || !data.webhookConfigured} title={!data.webhookConfigured ? 'Save a webhook URL first' : undefined}>
            {testSlack.isPending ? 'Sending…' : 'Send test message'}
          </Button>
          {testResult && <span className="sf-note">{testResult}</span>}
          <div style={{ flex: 1 }} />
          {saveResult && <span className="sf-note">{saveResult}</span>}
          <Button variant="primary" onClick={onSave} disabled={update.isPending}>
            {update.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </div>

      <div className="set-card" style={{ marginTop: 24 }}>
        <div className="set-card-head"><div className="set-card-title">Events</div><div className="set-card-sub">Which ticket activity gets posted to the channel.</div></div>
        <div className="set-card-body">
          {EVENT_TOGGLES.map((t) => (
            <div className="set-row" key={t.key}>
              <div><div className="sr-label">{t.label}</div><div className="sr-hint">{t.hint}</div></div>
              <input type="checkbox" checked={draft[t.key] as boolean} onChange={(e) => set(t.key, e.target.checked)} style={{ width: 18, height: 18, cursor: 'pointer' }} />
            </div>
          ))}
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
