// SPDX-License-Identifier: AGPL-3.0-only

import { useState, type FormEvent } from 'react';
import '../console/console.css';
import { Icon } from '../console/icons';
import { forgotPassword, resetPassword } from './api';

/** Read the reset token from the hash route: /#/reset-password?token=... */
export function readResetToken(): string | null {
  const hash = window.location.hash;
  const qIdx = hash.indexOf('?');
  if (qIdx === -1) return null;
  return new URLSearchParams(hash.slice(qIdx + 1)).get('token');
}

function backToLogin() {
  window.location.hash = '#/login';
}

/** "Forgot password" — asks for an email, always reports success (no enumeration). */
export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong — please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-badge"><Icon name="mail" size={26} /></div>
        <h1 className="login-title">Reset your password</h1>
        {sent ? (
          <>
            <p className="login-subtitle">
              If an account exists for <strong>{email}</strong>, a reset link is on its way.
              The link works once and expires in 1 hour. No email? Ask your admin to reset
              your password from Settings → Members.
            </p>
            <button className="login-submit" type="button" onClick={backToLogin}>Back to sign in</button>
          </>
        ) : (
          <>
            <p className="login-subtitle">Enter your account email and we'll send you a reset link.</p>
            <form onSubmit={submit} className="login-form">
              <label className="login-field">
                <Icon name="mail" size={17} className="lf-icon" />
                <input type="email" aria-label="Email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus required />
              </label>
              {error && <div className="login-error" role="alert">{error}</div>}
              <button className="login-submit" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</button>
            </form>
            <button className="login-link" type="button" onClick={backToLogin}>Back to sign in</button>
          </>
        )}
      </div>
    </div>
  );
}

/** Landing page for the emailed link — sets a new password from the token. */
export function ResetPasswordPage() {
  const [token] = useState(readResetToken);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await resetPassword(token ?? '', password);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong — please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-badge"><Icon name="lock" size={26} /></div>
        <h1 className="login-title">{done ? 'Password updated' : 'Choose a new password'}</h1>
        {done ? (
          <>
            <p className="login-subtitle">Your password has been changed and all other sessions were signed out. Sign in with your new password.</p>
            <button className="login-submit" type="button" onClick={backToLogin}>Go to sign in</button>
          </>
        ) : !token ? (
          <>
            <p className="login-subtitle">This reset link is missing its token. Open the link from your email again, or request a new one.</p>
            <button className="login-submit" type="button" onClick={() => { window.location.hash = '#/forgot-password'; }}>Request a new link</button>
          </>
        ) : (
          <form onSubmit={submit} className="login-form">
            <label className="login-field">
              <Icon name="lock" size={17} className="lf-icon" />
              <input type="password" aria-label="New password" placeholder="New password (min 8 characters)" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} autoFocus required />
            </label>
            <label className="login-field">
              <Icon name="lock" size={17} className="lf-icon" />
              <input type="password" aria-label="Confirm new password" placeholder="Confirm new password" value={confirm} onChange={(e) => setConfirm(e.target.value)} minLength={8} required />
            </label>
            {error && <div className="login-error" role="alert">{error}</div>}
            <button className="login-submit" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Set new password'}</button>
          </form>
        )}
      </div>
    </div>
  );
}
