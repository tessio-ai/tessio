// SPDX-License-Identifier: AGPL-3.0-only

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { LoginPage } from './auth/LoginPage';
import { Console } from './console/Console';
import { RequesterPortal } from './console/portal';
import { BotProvider } from './console/bot';
import './console/console.css';

const queryClient = new QueryClient();

function StandalonePortal() {
  return <div className="reqportal-standalone"><RequesterPortal /></div>;
}

function Routed() {
  const { user, loading, login } = useAuth();

  if (loading) return <div className="app-loading">Loading…</div>;
  // Self-hosted: the app opens straight to sign-in (no marketing/cloud landing).
  if (!user) return <LoginPage onLogin={login} />;
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
