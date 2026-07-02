// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Sidebar } from './shell';

const baseUser = { id: '1', email: 'a@b.io', name: 'Ada Lovelace', role: 'admin' as const };

// The Sidebar fetches the org name + portal brand via React Query; wrap it in a provider.
// The org/portal queries resolve to undefined here (unmocked), so the brand falls back to
// its default — these tests only assert the user name + role-gated nav.
function wrap(node: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{node}</QueryClientProvider>;
}

describe('Sidebar role gating', () => {
  it('shows the signed-in user name', () => {
    render(wrap(<Sidebar route={{ screen: 'tickets' }} go={() => {}} collapsed={false} user={baseUser} onLogout={vi.fn()} />));
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
  });

  it('hides the Forms (admin) nav item for an agent', () => {
    render(wrap(<Sidebar route={{ screen: 'tickets' }} go={() => {}} collapsed={false} user={{ ...baseUser, role: 'agent' }} onLogout={vi.fn()} />));
    expect(screen.queryByText('Forms')).not.toBeInTheDocument();
  });

  it('shows the Forms nav item for an admin', () => {
    render(wrap(<Sidebar route={{ screen: 'tickets' }} go={() => {}} collapsed={false} user={baseUser} onLogout={vi.fn()} />));
    expect(screen.getByText('Forms')).toBeInTheDocument();
  });
});
