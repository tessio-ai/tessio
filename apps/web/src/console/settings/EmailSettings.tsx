// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useState } from 'react';
import { Button } from '../ui';
import { useEmailSettings, useUpdateEmailSettings, useTestSmtp } from './queries';
import { useTicketSchemas, useTeams } from '../tickets/queries';
import type { UpdateEmailSettingsInput } from '../../api/email';

interface Draft {
  enabled: boolean;
  smtpHost: string;
  smtpPort: string;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPassword: string;
  fromName: string;
  fromAddress: string;
  replyTo: string;
  inboundEnabled: boolean;
  imapHost: string;
  imapPort: string;
  imapSecure: boolean;
  imapUser: string;
  imapPassword: string;
  mailbox: string;
  acceptNewSenders: boolean;
  defaultSchemaId: string;
  defaultTeamId: string;
}

export function EmailSettings() {
  const { data } = useEmailSettings();
  const update = useUpdateEmailSettings();
  const testSmtp = useTestSmtp();
  const { data: schemas } = useTicketSchemas();
  const { data: teams } = useTeams();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [saveResult, setSaveResult] = useState<string | null>(null);

  useEffect(() => {
    if (data && !draft) {
      setDraft({
        enabled: data.enabled,
        smtpHost: data.smtpHost ?? '',
        smtpPort: data.smtpPort != null ? String(data.smtpPort) : '',
        smtpSecure: data.smtpSecure,
        smtpUser: data.smtpUser ?? '',
        smtpPassword: '',
        fromName: data.fromName ?? '',
        fromAddress: data.fromAddress ?? '',
        replyTo: data.replyTo ?? '',
        inboundEnabled: data.inboundEnabled,
        imapHost: data.imapHost ?? '',
        imapPort: data.imapPort != null ? String(data.imapPort) : '',
        imapSecure: data.imapSecure,
        imapUser: data.imapUser ?? '',
        imapPassword: '',
        mailbox: data.mailbox,
        acceptNewSenders: data.acceptNewSenders,
        defaultSchemaId: data.defaultSchemaId ?? '',
        defaultTeamId: data.defaultTeamId ?? '',
      });
    }
  }, [data, draft]);

  if (!draft || !data) return <div className="page-pad muted">Loading…</div>;

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft({ ...draft, [k]: v });

  const onSave = () => {
    const patch: UpdateEmailSettingsInput = {
      enabled: draft.enabled,
      smtpHost: draft.smtpHost || undefined,
      smtpPort: draft.smtpPort ? parseInt(draft.smtpPort, 10) : undefined,
      smtpSecure: draft.smtpSecure,
      smtpUser: draft.smtpUser || undefined,
      fromName: draft.fromName || undefined,
      fromAddress: draft.fromAddress || undefined,
      replyTo: draft.replyTo || null,
      inboundEnabled: draft.inboundEnabled,
      imapHost: draft.imapHost || undefined,
      imapPort: draft.imapPort ? parseInt(draft.imapPort, 10) : undefined,
      imapSecure: draft.imapSecure,
      imapUser: draft.imapUser || undefined,
      mailbox: draft.mailbox || undefined,
      acceptNewSenders: draft.acceptNewSenders,
      defaultSchemaId: draft.defaultSchemaId || null,
      defaultTeamId: draft.defaultTeamId || null,
    };
    if (draft.smtpPassword.trim()) patch.smtpPassword = draft.smtpPassword.trim();
    if (draft.imapPassword.trim()) patch.imapPassword = draft.imapPassword.trim();
    setSaveResult(null);
    update.mutate(patch, {
      onSuccess: () => {
        setDraft((prev) => prev ? { ...prev, smtpPassword: '', imapPassword: '' } : null);
        setSaveResult('Saved');
      },
      onError: (e) => setSaveResult(`Save failed: ${(e as Error).message}`),
    });
  };

  const onTest = () => {
    setTestResult(null);
    testSmtp.mutate(undefined, {
      onSuccess: () => setTestResult('Test email sent'),
      onError: (e) => setTestResult(`Failed: ${(e as Error).message}`),
    });
  };

  return (
    <>
      <h1 className="set-h">Email</h1>
      <p className="set-h-desc">Configure outbound (SMTP) and inbound (IMAP) email for notifications and ticket creation from email.</p>

      <div className="set-card">
        <div className="set-card-head"><div className="set-card-title">Outbound (SMTP)</div><div className="set-card-sub">Used to send ticket notifications and replies.</div></div>
        <div className="set-card-body">
          <div className="set-row">
            <div><div className="sr-label">Enable email</div><div className="sr-hint">Send notifications and replies via email.</div></div>
            <input type="checkbox" checked={draft.enabled} onChange={(e) => set('enabled', e.target.checked)} style={{ width: 18, height: 18, cursor: 'pointer' }} />
          </div>

          <div className="set-row">
            <div><div className="sr-label">SMTP host</div><div className="sr-hint">e.g. smtp.gmail.com</div></div>
            <input className="input" value={draft.smtpHost} placeholder="smtp.example.com" onChange={(e) => set('smtpHost', e.target.value)} style={{ maxWidth: 320 }} />
          </div>

          <div className="set-row">
            <div><div className="sr-label">SMTP port</div><div className="sr-hint">Typically 587 (TLS) or 465 (SSL)</div></div>
            <input className="input" value={draft.smtpPort} placeholder="587" onChange={(e) => set('smtpPort', e.target.value)} style={{ maxWidth: 120 }} type="number" />
          </div>

          <div className="set-row">
            <div><div className="sr-label">Use SSL/TLS</div><div className="sr-hint">Enable for port 465; STARTTLS uses port 587.</div></div>
            <input type="checkbox" checked={draft.smtpSecure} onChange={(e) => set('smtpSecure', e.target.checked)} style={{ width: 18, height: 18, cursor: 'pointer' }} />
          </div>

          <div className="set-row">
            <div><div className="sr-label">SMTP username</div><div className="sr-hint">Usually your email address.</div></div>
            <input className="input" value={draft.smtpUser} placeholder="user@example.com" onChange={(e) => set('smtpUser', e.target.value)} style={{ maxWidth: 320 }} />
          </div>

          <div className="set-row">
            <div><div className="sr-label">SMTP password</div><div className="sr-hint">{data.smtpConfigured ? 'Configured — leave blank to keep.' : 'Stored encrypted; never shown again.'}</div></div>
            <input
              className="input"
              type="password"
              value={draft.smtpPassword}
              placeholder={data.smtpConfigured ? '•••••••• (leave blank to keep)' : 'Enter SMTP password'}
              onChange={(e) => set('smtpPassword', e.target.value)}
              style={{ maxWidth: 320 }}
            />
          </div>

          <div className="set-row">
            <div><div className="sr-label">From name</div><div className="sr-hint">Display name for outgoing mail.</div></div>
            <input className="input" value={draft.fromName} placeholder="Tessio Support" onChange={(e) => set('fromName', e.target.value)} style={{ maxWidth: 320 }} />
          </div>

          <div className="set-row">
            <div><div className="sr-label">From address</div><div className="sr-hint">The sender email address.</div></div>
            <input className="input" value={draft.fromAddress} placeholder="support@example.com" onChange={(e) => set('fromAddress', e.target.value)} style={{ maxWidth: 320 }} type="email" />
          </div>

          <div className="set-row">
            <div><div className="sr-label">Reply-to address</div><div className="sr-hint">Optional — overrides the From address for replies.</div></div>
            <input className="input" value={draft.replyTo} placeholder="tickets@example.com" onChange={(e) => set('replyTo', e.target.value)} style={{ maxWidth: 320 }} type="email" />
          </div>
        </div>

        <div className="set-card-foot">
          <Button variant="outline" onClick={onTest} disabled={testSmtp.isPending || !data.smtpConfigured} title={!data.smtpConfigured ? 'Save SMTP credentials first' : undefined}>
            {testSmtp.isPending ? 'Sending…' : 'Send test email'}
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
        <div className="set-card-head"><div className="set-card-title">Inbound (IMAP)</div><div className="set-card-sub">Poll a mailbox to create tickets from incoming email.</div></div>
        <div className="set-card-body">
          <div className="set-row">
            <div><div className="sr-label">Enable inbound email</div><div className="sr-hint">Poll the configured mailbox for new messages.</div></div>
            <input type="checkbox" checked={draft.inboundEnabled} onChange={(e) => set('inboundEnabled', e.target.checked)} style={{ width: 18, height: 18, cursor: 'pointer' }} />
          </div>

          <div className="set-row">
            <div><div className="sr-label">IMAP host</div><div className="sr-hint">e.g. imap.gmail.com</div></div>
            <input className="input" value={draft.imapHost} placeholder="imap.example.com" onChange={(e) => set('imapHost', e.target.value)} style={{ maxWidth: 320 }} />
          </div>

          <div className="set-row">
            <div><div className="sr-label">IMAP port</div><div className="sr-hint">Typically 993 (SSL) or 143 (STARTTLS)</div></div>
            <input className="input" value={draft.imapPort} placeholder="993" onChange={(e) => set('imapPort', e.target.value)} style={{ maxWidth: 120 }} type="number" />
          </div>

          <div className="set-row">
            <div><div className="sr-label">Use SSL/TLS</div><div className="sr-hint">Enable for port 993.</div></div>
            <input type="checkbox" checked={draft.imapSecure} onChange={(e) => set('imapSecure', e.target.checked)} style={{ width: 18, height: 18, cursor: 'pointer' }} />
          </div>

          <div className="set-row">
            <div><div className="sr-label">IMAP username</div><div className="sr-hint">Usually your email address.</div></div>
            <input className="input" value={draft.imapUser} placeholder="user@example.com" onChange={(e) => set('imapUser', e.target.value)} style={{ maxWidth: 320 }} />
          </div>

          <div className="set-row">
            <div><div className="sr-label">IMAP password</div><div className="sr-hint">{data.imapConfigured ? 'Configured — leave blank to keep.' : 'Stored encrypted; never shown again.'}</div></div>
            <input
              className="input"
              type="password"
              value={draft.imapPassword}
              placeholder={data.imapConfigured ? '•••••••• (leave blank to keep)' : 'Enter IMAP password'}
              onChange={(e) => set('imapPassword', e.target.value)}
              style={{ maxWidth: 320 }}
            />
          </div>

          <div className="set-row">
            <div><div className="sr-label">Mailbox</div><div className="sr-hint">Which folder to poll (default: INBOX).</div></div>
            <input className="input" value={draft.mailbox} placeholder="INBOX" onChange={(e) => set('mailbox', e.target.value)} style={{ maxWidth: 200 }} />
          </div>

          <div className="set-row">
            <div><div className="sr-label">Accept new senders</div><div className="sr-hint">Create tickets from senders who aren't existing requesters.</div></div>
            <input type="checkbox" checked={draft.acceptNewSenders} onChange={(e) => set('acceptNewSenders', e.target.checked)} style={{ width: 18, height: 18, cursor: 'pointer' }} />
          </div>

          <div className="set-row">
            <div><div className="sr-label">Default ticket type</div><div className="sr-hint">Required when inbound is enabled — ticket type for new tickets from email.</div></div>
            <select
              className="input"
              value={draft.defaultSchemaId}
              onChange={(e) => set('defaultSchemaId', e.target.value)}
              style={{ maxWidth: 320 }}
              required={draft.inboundEnabled}
            >
              <option value="">— select a ticket type —</option>
              {(schemas ?? []).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className="set-row">
            <div><div className="sr-label">Default team</div><div className="sr-hint">Optional — assign new inbound tickets to this team.</div></div>
            <select
              className="input"
              value={draft.defaultTeamId}
              onChange={(e) => set('defaultTeamId', e.target.value)}
              style={{ maxWidth: 320 }}
            >
              <option value="">— none —</option>
              {(teams ?? []).map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
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
