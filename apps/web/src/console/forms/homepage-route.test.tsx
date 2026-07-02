// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { AuthProvider } from '../../auth/AuthContext';
import { Console } from '../Console';
import * as authApi from '../../auth/api';
import * as formsApi from '../../api/forms';
import * as portalApi from '../../api/portal';

function wrap(node: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}><AuthProvider>{node}</AuthProvider></QueryClientProvider>;
}
beforeEach(() => vi.restoreAllMocks());
afterEach(() => vi.restoreAllMocks());

const admin = { id: '1', email: 'a@b.io', name: 'Ada', role: 'admin' as const };
const settings = { orgId: 'o', brandName: 'Acme', logo: 'A', heroHeadline: 'How can we help?', heroIntro: '', accent: '#4f46e5', showTess: true, categories: [], updatedAt: '',
  hero: { preset: 'spotlight', pills: [], showSearch: true },
  catalog: { sectionStyle: 'band', cardStyle: 'comfortable', columns: 'auto' },
};

describe('homepage editor routing', () => {
  it('Edit homepage navigates and renders the PortalEditor', async () => {
    vi.spyOn(authApi, 'me').mockResolvedValue(admin);
    vi.spyOn(formsApi, 'listForms').mockResolvedValue([]);
    vi.spyOn(portalApi, 'getPortalSettings').mockResolvedValue(settings as never);
    render(wrap(<Console user={admin} />));
    await userEvent.click(screen.getByText('Forms'));
    await userEvent.click(await screen.findByRole('button', { name: /edit homepage/i }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Homepage' })).toBeInTheDocument());
  });
});
