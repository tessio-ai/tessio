// SPDX-License-Identifier: AGPL-3.0-only

import { useState, useEffect, type FormEvent } from 'react';
import '../console/console.css';
import { getSsoInfo } from '../api/sso';

const SSO_ERROR_MESSAGES: Record<string, string> = {
  no_account: 'No Tessio account matches your SSO identity. Ask an admin to add you first.',
  domain: "Your email domain isn't allowed for SSO here.",
  unverified: "Your SSO email isn't verified.",
  disabled_user: 'Your account is disabled.',
  bad_state: 'Single sign-on failed. Please try again.',
  auth_failed: 'Single sign-on failed. Please try again.',
};

function readSsoError(): string | null {
  // Hash router: URL looks like /#/login?sso_error=...
  // Try window.location.search first (some configs put QS outside the hash).
  const fromSearch = new URLSearchParams(window.location.search).get('sso_error');
  if (fromSearch) return fromSearch;
  // Then check inside the hash fragment (everything after '?' in the hash).
  const hash = window.location.hash; // e.g. "#/login?sso_error=no_account"
  const qIdx = hash.indexOf('?');
  if (qIdx !== -1) {
    return new URLSearchParams(hash.slice(qIdx + 1)).get('sso_error');
  }
  return null;
}

export function LoginPage({ onLogin }: { onLogin: (email: string, password: string) => Promise<void> }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ssoEnabled, setSsoEnabled] = useState(false);
  const [ssoLabel, setSsoLabel] = useState('Sign in with SSO');
  const [ssoError, setSsoError] = useState<string | null>(null);

  useEffect(() => {
    // Read any SSO error from the redirect URL.
    const code = readSsoError();
    if (code) {
      setSsoError(SSO_ERROR_MESSAGES[code] ?? 'Single sign-on failed. Please try again.');
    }

    // Fetch SSO info; swallow errors → treat as disabled.
    getSsoInfo()
      .then(({ enabled, buttonLabel }) => {
        setSsoEnabled(enabled);
        if (buttonLabel) setSsoLabel(buttonLabel);
      })
      .catch(() => {
        // SSO unavailable — keep disabled state.
      });
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onLogin(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-logo">T</div>
          <div className="login-title">Sign in to Tessio</div>
        </div>

        {ssoError && (
          <div className="login-error" role="alert">{ssoError}</div>
        )}

        {ssoEnabled && (
          <>
            <button
              type="button"
              className="btn btn-primary login-submit"
              onClick={() => { window.location.href = '/api/v1/auth/sso/start'; }}
            >
              {ssoLabel}
            </button>
            <div className="login-divider">
              <span>or</span>
            </div>
          </>
        )}

        <form onSubmit={submit} style={{ display: 'contents' }}>
          <label className="login-field" htmlFor="login-email">
            <span>Email</span>
            <input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus={!ssoEnabled} required />
          </label>
          <label className="login-field" htmlFor="login-password">
            <span>Password</span>
            <input id="login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          {error && <div className="login-error" role="alert">{error}</div>}
          <button className="btn btn-primary login-submit" type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
