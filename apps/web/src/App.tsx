// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { LoginPage } from './auth/LoginPage';
import { ForgotPasswordPage, ResetPasswordPage } from './auth/ResetPasswordPage';
import { Console } from './console/Console';
import { RequesterPortal } from './console/portal';
import { BotProvider } from './console/bot';
import './console/console.css';

const queryClient = new QueryClient();

function StandalonePortal() {
  return <div className="reqportal-standalone"><RequesterPortal /></div>;
}

/** The current hash path (before any '?'), tracked across hashchange events. */
function useHashPath(): string {
  const read = () => window.location.hash.split('?')[0];
  const [path, setPath] = useState(read);
  useEffect(() => {
    const onChange = () => setPath(read());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return path;
}

function Routed() {
  const { user, loading, login } = useAuth();
  const hashPath = useHashPath();

  if (loading) return <div className="app-loading">Loading…</div>;
  // Self-hosted: the app opens straight to sign-in (no marketing/cloud landing).
  if (!user) {
    if (hashPath === '#/forgot-password') return <ForgotPasswordPage />;
    if (hashPath === '#/reset-password') return <ResetPasswordPage />;
    return <LoginPage onLogin={login} />;
  }
  if (user.role === 'requester') return <BotProvider><StandalonePortal /></BotProvider>;
  return <BotProvider><Console user={user} /></BotProvider>;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Routed />
      </AuthProvider>
    </QueryClientProvider>
  );
}
