// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { App } from './App';
import * as authApi from './auth/api';
import * as portalApi from './api/portal';
import * as orgApi from './api/org';

beforeEach(() => vi.restoreAllMocks());
afterEach(() => vi.restoreAllMocks());

describe('App role routing', () => {
  it('shows the sign-in page when unauthenticated (no marketing/cloud landing)', async () => {
    vi.spyOn(authApi, 'me').mockRejectedValue(new Error('401'));
    render(<App />);
    // The sign-in card shows the wordmark + "Welcome back" prompt (not a landing page).
    await waitFor(() => expect(screen.getByText(/welcome back/i)).toBeInTheDocument());
  });

  it('shows the console for an admin', async () => {
    vi.spyOn(authApi, 'me').mockResolvedValue({ id: '1', email: 'a@b.io', name: 'Ada', role: 'admin' });
    // The sidebar shows the org name from the ['org'] query.
    vi.spyOn(orgApi, 'getOrg').mockResolvedValue({ id: 'o1', name: 'Acme Corp', slug: 'acme', createdAt: '' } as never);
    render(<App />);
    await waitFor(() => expect(screen.getByText('Acme Corp')).toBeInTheDocument());
  });

  it('shows the requester portal (no console nav) for a requester', async () => {
    vi.spyOn(authApi, 'me').mockResolvedValue({ id: '2', email: 'r@b.io', name: 'Dana', role: 'requester' });
    vi.spyOn(portalApi, 'getPublicPortalSettings').mockResolvedValue({ orgId: 'o', brandName: 'Acme', logo: 'A', heroHeadline: 'How can we help?', heroIntro: '', accent: '#4f46e5', showTess: true, categories: [], updatedAt: '', hero: { preset: 'spotlight', pills: [], showSearch: true }, catalog: { sectionStyle: 'band', cardStyle: 'comfortable', columns: 'auto' } } as never);
    vi.spyOn(portalApi, 'listPublicForms').mockResolvedValue([] as never);
    render(<App />);
    await waitFor(() => expect(screen.getByText(/how can we help/i)).toBeInTheDocument());
    expect(screen.queryByText('IT Service Desk')).not.toBeInTheDocument();
  });
});
