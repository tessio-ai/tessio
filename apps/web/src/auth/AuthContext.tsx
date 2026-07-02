// SPDX-License-Identifier: AGPL-3.0-only

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { me as fetchMe, login as apiLogin, logout as apiLogout, type AuthUser } from './api';
import { setUnauthorizedHandler } from '../api/client';

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    fetchMe().then(setUser).catch(() => setUser(null)).finally(() => setLoading(false));
    return () => setUnauthorizedHandler(null);
  }, []);

  const login = async (email: string, password: string) => {
    setUser(await apiLogin(email, password));
  };
  const logout = async () => {
    await apiLogout();
    setUser(null);
  };

  return <Ctx.Provider value={{ user, loading, login, logout }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
