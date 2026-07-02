// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useState } from 'react';
import { Button } from '../ui';
import { useNotificationPrefs, useUpdateNotificationPrefs } from './queries';
import type { NotificationPrefs } from '../../api/notifications';

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      className={'toggle' + (checked ? ' on' : '')}
      onClick={() => onChange(!checked)}
      style={{ width: 40, height: 22, borderRadius: 11, background: checked ? 'var(--primary)' : 'var(--muted-2)', border: '1px solid var(--border)', position: 'relative', cursor: 'pointer', transition: 'background .15s' }}
    >
      <span style={{ position: 'absolute', top: 2, left: checked ? 20 : 2, width: 16, height: 16, borderRadius: 8, background: '#fff', boxShadow: 'var(--shadow-sm)', transition: 'left .15s' }} />
    </button>
  );
}

export function NotificationSettings() {
  const { data } = useNotificationPrefs();
  const update = useUpdateNotificationPrefs();
  const [draft, setDraft] = useState<NotificationPrefs | null>(null);
  const [saveResult, setSaveResult] = useState<string | null>(null);

  useEffect(() => {
    if (data && !draft) setDraft({ ...data });
  }, [data, draft]);

  if (!draft || !data) return <div className="page-pad muted">Loading…</div>;

  const set = <K extends keyof NotificationPrefs>(k: K, v: NotificationPrefs[K]) =>
    setDraft({ ...draft, [k]: v });

  const onSave = () => {
    setSaveResult(null);
    update.mutate(draft, {
      onSuccess: () => setSaveResult('Saved'),
      onError: (e) => setSaveResult(`Save failed: ${(e as Error).message}`),
    });
  };

  return (
    <>
      <h1 className="set-h">Notifications</h1>
      <p className="set-h-desc">Choose what you're notified about. Email notifications require email to be configured by an admin.</p>

      <div className="set-card">
        <div className="set-card-body">
          <div className="set-row">
            <div><div className="sr-label">Email notifications</div><div className="sr-hint">Receive notifications via email.</div></div>
            <Toggle checked={draft.emailEnabled} onChange={(v) => set('emailEnabled', v)} />
          </div>

          <div className="set-row">
            <div><div className="sr-label">Ticket assigned to me</div><div className="sr-hint">Get notified when a ticket is assigned to you.</div></div>
            <Toggle checked={draft.assigned} onChange={(v) => set('assigned', v)} />
          </div>

          <div className="set-row">
            <div><div className="sr-label">New replies</div><div className="sr-hint">Notified when someone replies to a ticket you're watching.</div></div>
            <Toggle checked={draft.replies} onChange={(v) => set('replies', v)} />
          </div>

          <div className="set-row">
            <div><div className="sr-label">Status changes</div><div className="sr-hint">Notified when a ticket you're watching changes status.</div></div>
            <Toggle checked={draft.statusChanges} onChange={(v) => set('statusChanges', v)} />
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
