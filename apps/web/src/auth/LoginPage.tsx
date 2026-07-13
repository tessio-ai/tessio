// SPDX-License-Identifier: AGPL-3.0-only

import { useState, useEffect, type FormEvent, type CSSProperties } from 'react';
import '../console/console.css';
import { Icon } from '../console/icons';
import { getSsoInfo } from '../api/sso';
import { getLoginBranding, type LoginBranding } from '../api/login-settings';

const SSO_ERROR_MESSAGES: Record<string, string> = {
  no_account: 'No Tessio account matches your SSO identity. Ask an admin to add you first.',
  domain: "Your email domain isn't allowed for SSO here.",
  unverified: "Your SSO email isn't verified.",
  disabled_user: 'Your account is disabled.',
  bad_state: 'Single sign-on failed. Please try again.',
  auth_failed: 'Single sign-on failed. Please try again.',
};

const DEFAULT_BRANDING: LoginBranding = {
  brandName: 'Tessio',
  logo: null,
  headline: 'Welcome back',
  tagline: 'Sign in to your workspace to pick up where you left off.',
  accent: '#4f46e5',
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
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ssoEnabled, setSsoEnabled] = useState(false);
  const [ssoLabel, setSsoLabel] = useState('Sign in with SSO');
  const [ssoError, setSsoError] = useState<string | null>(null);
  const [branding, setBranding] = useState<LoginBranding>(DEFAULT_BRANDING);

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

    // Fetch workspace branding; swallow errors → keep stock branding.
    getLoginBranding()
      .then(setBranding)
      .catch(() => {
        // Branding unavailable — keep defaults.
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
    <div className="login-screen" style={{ '--login-accent': branding.accent } as CSSProperties}>
      <div className="login-sky" aria-hidden="true">
        <span className="login-arc a1"></span>
        <span className="login-arc a2"></span>
        <span className="login-arc a3"></span>
        <span className="login-cloud c1"></span>
        <span className="login-cloud c2"></span>
        <span className="login-cloud c3"></span>
        <span className="login-cloud c4"></span>
        <span className="login-cloud c5"></span>
      </div>

      <header className="login-topbar">
        {branding.logo ? (
          <img className="login-brandmark" src={branding.logo} alt="" />
        ) : (
          <span className="login-brandmark login-brandmark-default"><Icon name="zap" size={16} /></span>
        )}
        <span className="login-brandname">{branding.brandName}</span>
      </header>

      <div className="login-card">
        <div className="login-badge">
          {branding.logo
            ? <img src={branding.logo} alt="" />
            : <Icon name="logIn" size={26} />}
        </div>
        <h1 className="login-title">{branding.headline}</h1>
        <p className="login-subtitle">{branding.tagline}</p>

        {ssoError && (
          <div className="login-error" role="alert">{ssoError}</div>
        )}

        <form onSubmit={submit} className="login-form">
          <label className="login-field">
            <Icon name="mail" size={17} className="lf-icon" />
            <input
              id="login-email"
              type="email"
              aria-label="Email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              required
            />
          </label>
          <label className="login-field">
            <Icon name="lock" size={17} className="lf-icon" />
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              aria-label="Password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              className="login-eye"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowPassword((v) => !v)}
            >
              <Icon name={showPassword ? 'eye' : 'eyeOff'} size={17} />
            </button>
          </label>
          {error && <div className="login-error" role="alert">{error}</div>}
          <button className="login-submit" type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {ssoEnabled && (
          <>
            <div className="login-divider">
              <span>Or continue with</span>
            </div>
            <button
              type="button"
              className="login-sso"
              onClick={() => { window.location.href = '/api/v1/auth/sso/start'; }}
            >
              {ssoLabel}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
