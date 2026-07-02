// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { RequesterCatalog } from '../portal';
import * as portalApi from '../../api/portal';

function wrap(node: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{node}</QueryClientProvider>;
}
beforeEach(() => vi.restoreAllMocks());
afterEach(() => vi.restoreAllMocks());

const settings = { orgId: 'o', brandName: 'Acme', logo: 'A', heroHeadline: 'How can we help?', heroIntro: 'Ask away', accent: '#4f46e5', showTess: true,
  categories: [{ key: 'IT', label: 'IT & Software', icon: 'laptop', color: '#2563eb', order: 0, visible: true }], updatedAt: '',
  hero: { preset: 'spotlight', pills: [{ label: 'Quick help', formKey: 'quick' }], showSearch: true },
  catalog: { sectionStyle: 'band', cardStyle: 'comfortable', columns: 'auto' } };
const forms = [{ key: 'report', name: 'Report an issue', description: 'broken things', categoryKey: 'IT', icon: 'alert', theme: { showTess: true } }];

describe('RequesterCatalog', () => {
  it('renders categories + forms and opens a form on click', async () => {
    vi.spyOn(portalApi, 'getPublicPortalSettings').mockResolvedValue(settings as never);
    vi.spyOn(portalApi, 'listPublicForms').mockResolvedValue(forms as never);
    const onOpenForm = vi.fn();
    render(wrap(<RequesterCatalog onOpenForm={onOpenForm}  />));
    await waitFor(() => expect(screen.getByText('Report an issue')).toBeInTheDocument());
    expect(screen.getByText(/how can we help/i)).toBeInTheDocument();
    expect(screen.getByText('IT & Software')).toBeInTheDocument();
    // The card is a real button (keyboard-focusable, not a clickable div).
    await userEvent.click(screen.getByRole('button', { name: /report an issue/i }));
    expect(onOpenForm).toHaveBeenCalledWith('report');
  });

  it('surfaces forms whose category does not match any visible category under "Other requests"', async () => {
    const orphanForm = [{ key: 'vpn', name: 'VPN access', description: 'remote access', categoryKey: 'NETWORK', icon: 'wifi', theme: { showTess: false } }];
    vi.spyOn(portalApi, 'getPublicPortalSettings').mockResolvedValue(settings as never);
    vi.spyOn(portalApi, 'listPublicForms').mockResolvedValue(orphanForm as never);
    const onOpenForm = vi.fn();
    render(wrap(<RequesterCatalog onOpenForm={onOpenForm}  />));
    // The form is reachable even though its categoryKey ("NETWORK") matches no visible category.
    await waitFor(() => expect(screen.getByText('VPN access')).toBeInTheDocument());
    expect(screen.getByText(/other requests/i)).toBeInTheDocument();
    await userEvent.click(screen.getByText('VPN access'));
    expect(onOpenForm).toHaveBeenCalledWith('vpn');
  });

  it('shows an empty state, not a void, when there are no published forms', async () => {
    vi.spyOn(portalApi, 'getPublicPortalSettings').mockResolvedValue(settings as never);
    vi.spyOn(portalApi, 'listPublicForms').mockResolvedValue([] as never);
    render(wrap(<RequesterCatalog onOpenForm={vi.fn()}  />));
    await waitFor(() => expect(screen.getByText(/no request types/i)).toBeInTheDocument());
    expect(screen.queryByText('IT & Software')).not.toBeInTheDocument();
  });

  it('shows an error state with a working retry when the catalog fails to load', async () => {
    vi.spyOn(portalApi, 'getPublicPortalSettings').mockResolvedValue(settings as never);
    const list = vi.spyOn(portalApi, 'listPublicForms')
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue(forms as never);
    render(wrap(<RequesterCatalog onOpenForm={vi.fn()}  />));
    await waitFor(() => expect(screen.getByText(/couldn't load/i)).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    await waitFor(() => expect(screen.getByText('Report an issue')).toBeInTheDocument());
    expect(list).toHaveBeenCalledTimes(2);
  });
});
