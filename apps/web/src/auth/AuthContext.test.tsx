// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import * as authApi from './api';

function Probe() {
  const { user, loading } = useAuth();
  if (loading) return <div>loading</div>;
  return <div>{user ? `${user.name}:${user.role}` : 'anon'}</div>;
}

beforeEach(() => vi.restoreAllMocks());
afterEach(() => vi.restoreAllMocks());

describe('AuthContext', () => {
  it('loads the current user from me() on mount', async () => {
    vi.spyOn(authApi, 'me').mockResolvedValue({ id: '1', email: 'a@b.io', name: 'Ada', role: 'admin' });
    render(<AuthProvider><Probe /></AuthProvider>);
    expect(screen.getByText('loading')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Ada:admin')).toBeInTheDocument());
  });

  it('renders anon when me() rejects (401)', async () => {
    vi.spyOn(authApi, 'me').mockRejectedValue(new Error('401'));
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByText('anon')).toBeInTheDocument());
  });
});
