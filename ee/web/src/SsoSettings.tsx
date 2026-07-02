// SPDX-License-Identifier: LicenseRef-Tessio-Commercial

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEeHost } from '@tessio/web-ee-host';

interface SsoSettingsView {
  enabled: boolean;
  issuer: string | null;
  clientId: string | null;
  buttonLabel: string;
  autoCreateUsers: boolean;
  allowedDomain: string | null;
  clientSecretConfigured: boolean;
  redirectUri: string;
}

interface UpdateSsoSettingsInput {
  enabled?: boolean;
  issuer?: string;
  clientId?: string;
  clientSecret?: string;
  buttonLabel?: string;
  autoCreateUsers?: boolean;
  allowedDomain?: string | null;
}

interface Draft {
  enabled: boolean;
  issuer: string;
  clientId: string;
  clientSecret: string;
  buttonLabel: string;
  allowedDomain: string;
  autoCreateUsers: boolean;
}

export function SsoSettings() {
  const { Button, Icon, request } = useEeHost();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['sso-settings'],
    queryFn: () => request<SsoSettingsView>('/sso-settings'),
  });
  const update = useMutation({
    mutationFn: (patch: UpdateSsoSettingsInput) =>
      request<SsoSettingsView>('/sso-settings', { method: 'PUT', body: JSON.stringify(patch) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sso-settings'] }),
  });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saveResult, setSaveResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (data && !draft) {
      setDraft({
        enabled: data.enabled,
        issuer: data.issuer ?? '',
        clientId: data.clientId ?? '',
        clientSecret: '',
        buttonLabel: data.buttonLabel,
        allowedDomain: data.allowedDomain ?? '',
        autoCreateUsers: data.autoCreateUsers,
      });
    }
  }, [data, draft]);

  if (!draft || !data) return <div className="page-pad muted">Loading…</div>;

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft({ ...draft, [k]: v });

  const onSave = () => {
    const patch: UpdateSsoSettingsInput = {
      enabled: draft.enabled,
      issuer: draft.issuer || undefined,
      clientId: draft.clientId || undefined,
      buttonLabel: draft.buttonLabel || undefined,
      autoCreateUsers: draft.autoCreateUsers,
      allowedDomain: draft.allowedDomain || null,
    };
    if (draft.clientSecret.trim()) patch.clientSecret = draft.clientSecret.trim();
    setSaveResult(null);
    update.mutate(patch, {
      onSuccess: () => {
        setDraft((prev) => (prev ? { ...prev, clientSecret: '' } : null));
        setSaveResult('Saved');
      },
      onError: (e) => setSaveResult(`Save failed: ${(e as Error).message}`),
    });
  };

  const copyRedirectUri = () => {
    navigator.clipboard.writeText(data.redirectUri).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <>
      <h1 className="set-h">Single sign-on</h1>
      <p className="set-h-desc">Configure OIDC-based single sign-on so your team can authenticate via your identity provider.</p>

      <div className="set-card">
        <div className="set-card-head">
          <div className="set-card-title">Redirect URI</div>
          <div className="set-card-sub">Register this URI in your identity provider before enabling SSO.</div>
        </div>
        <div className="set-card-body">
          <div className="set-row">
            <div>
              <div className="sr-label">Callback URL</div>
              <div className="sr-hint">Register this redirect URI in your identity provider.</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <code style={{ fontSize: 'var(--t-small)', background: 'var(--muted)', padding: '4px 8px', borderRadius: 6, wordBreak: 'break-all' }}>
                {data.redirectUri}
              </code>
              <button
                type="button"
                className="btn btn-outline"
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', fontSize: 'var(--t-small)' }}
                onClick={copyRedirectUri}
                title="Copy to clipboard"
              >
                <Icon name={copied ? 'checkCheck' : 'copy'} size={13} />
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="set-card" style={{ marginTop: 24 }}>
        <div className="set-card-head">
          <div className="set-card-title">OIDC provider</div>
          <div className="set-card-sub">Settings for your OpenID Connect identity provider.</div>
        </div>
        <div className="set-card-body">
          <div className="set-row">
            <div><div className="sr-label">Enable SSO</div><div className="sr-hint">Show the SSO button on the login page.</div></div>
            <input type="checkbox" checked={draft.enabled} onChange={(e) => set('enabled', e.target.checked)} style={{ width: 18, height: 18, cursor: 'pointer' }} />
          </div>

          <div className="set-row">
            <div><div className="sr-label">Issuer URL</div><div className="sr-hint">The OIDC issuer URL (e.g. https://accounts.google.com).</div></div>
            <input
              className="input"
              value={draft.issuer}
              placeholder="https://your-idp.example.com"
              onChange={(e) => set('issuer', e.target.value)}
              style={{ maxWidth: 400 }}
              type="url"
            />
          </div>

          <div className="set-row">
            <div><div className="sr-label">Client ID</div><div className="sr-hint">The client/app ID from your identity provider.</div></div>
            <input
              className="input"
              value={draft.clientId}
              placeholder="your-client-id"
              onChange={(e) => set('clientId', e.target.value)}
              style={{ maxWidth: 400 }}
            />
          </div>

          <div className="set-row">
            <div>
              <div className="sr-label">Client secret</div>
              <div className="sr-hint">{data.clientSecretConfigured ? 'Configured — leave blank to keep.' : 'Stored encrypted; never shown again.'}</div>
            </div>
            <input
              className="input"
              type="password"
              value={draft.clientSecret}
              placeholder={data.clientSecretConfigured ? '•••••••• (leave blank to keep)' : 'Enter client secret'}
              onChange={(e) => set('clientSecret', e.target.value)}
              style={{ maxWidth: 400 }}
            />
          </div>

          <div className="set-row">
            <div><div className="sr-label">Button label</div><div className="sr-hint">Text shown on the SSO button on the login page.</div></div>
            <input
              className="input"
              value={draft.buttonLabel}
              placeholder="Sign in with SSO"
              onChange={(e) => set('buttonLabel', e.target.value)}
              style={{ maxWidth: 320 }}
            />
          </div>
        </div>

        <div className="set-card-head" style={{ borderTop: '1px solid var(--border)', marginTop: 0 }}>
          <div className="set-card-title">Access control</div>
          <div className="set-card-sub">Restrict and provision SSO users.</div>
        </div>
        <div className="set-card-body">
          <div className="set-row">
            <div><div className="sr-label">Allowed email domain</div><div className="sr-hint">Optional — only allow SSO users with this domain (e.g. example.com). Leave blank to allow any verified email.</div></div>
            <input
              className="input"
              value={draft.allowedDomain}
              placeholder="example.com"
              onChange={(e) => set('allowedDomain', e.target.value)}
              style={{ maxWidth: 280 }}
            />
          </div>

          <div className="set-row">
            <div><div className="sr-label">Auto-create users</div><div className="sr-hint">Automatically create a Tessio account for new SSO users on first sign-in.</div></div>
            <input type="checkbox" checked={draft.autoCreateUsers} onChange={(e) => set('autoCreateUsers', e.target.checked)} style={{ width: 18, height: 18, cursor: 'pointer' }} />
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
