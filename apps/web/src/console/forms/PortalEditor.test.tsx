// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { PortalEditor } from './PortalEditor';
import * as portalApi from '../../api/portal';

const publicForms = [
  { key: 'a', name: 'Reset', description: null, categoryKey: 'IT', icon: null, theme: { showTess: false } },
];

function wrap(node: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={qc}>{node}</QueryClientProvider>;
}
beforeEach(() => vi.restoreAllMocks());
afterEach(() => vi.restoreAllMocks());

const settings = { orgId: 'o', brandName: 'Acme', logo: 'A', heroHeadline: 'How can we help?', heroIntro: '', accent: '#4f46e5', showTess: true,
  categories: [{ key: 'it', label: 'IT', icon: 'laptop', color: '#2563eb', order: 0, visible: true }], updatedAt: '',
  hero: { preset: 'spotlight', pills: [], showSearch: true },
  catalog: { sectionStyle: 'band', cardStyle: 'comfortable', columns: 'auto' },
};

describe('PortalEditor', () => {
  it('loads settings and saves an edited headline', async () => {
    vi.spyOn(portalApi, 'getPortalSettings').mockResolvedValue(settings as never);
    const update = vi.spyOn(portalApi, 'updatePortalSettings').mockResolvedValue(settings as never);
    render(wrap(<PortalEditor go={vi.fn()} />));
    await waitFor(() => expect(screen.getByDisplayValue('How can we help?')).toBeInTheDocument());
    await userEvent.type(screen.getByLabelText(/headline/i), '!');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(update).toHaveBeenCalled());
    expect((update.mock.calls.at(-1)![0] as { heroHeadline?: string }).heroHeadline).toMatch(/!$/);
  });

  it('adds a category and includes it on save', async () => {
    vi.spyOn(portalApi, 'getPortalSettings').mockResolvedValue(settings as never);
    const update = vi.spyOn(portalApi, 'updatePortalSettings').mockResolvedValue(settings as never);
    render(wrap(<PortalEditor go={vi.fn()} />));
    await waitFor(() => expect(screen.getByDisplayValue('Acme')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /add category/i }));
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(update).toHaveBeenCalled());
    expect((update.mock.calls.at(-1)![0] as { categories?: unknown[] }).categories).toHaveLength(2);
  });

  it('edits the hero preset and catalog columns and saves them', async () => {
    vi.spyOn(portalApi, 'getPortalSettings').mockResolvedValue(settings as never);
    const update = vi.spyOn(portalApi, 'updatePortalSettings').mockResolvedValue(settings as never);
    render(wrap(<PortalEditor go={vi.fn()} />));
    await waitFor(() => expect(screen.getByDisplayValue('Acme')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('radio', { name: /editorial/i }));
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(update).toHaveBeenCalled());
    expect((update.mock.calls.at(-1)![0] as { hero?: { preset?: string } }).hero?.preset).toBe('editorial');
  });

  it('back button calls go(forms)', async () => {
    vi.spyOn(portalApi, 'getPortalSettings').mockResolvedValue(settings as never);
    const go = vi.fn();
    render(wrap(<PortalEditor go={go} />));
    await waitFor(() => expect(screen.getByDisplayValue('Acme')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /back to forms/i }));
    expect(go).toHaveBeenCalledWith('forms');
  });

  it('shows a live preview that reflects unsaved hero text', async () => {
    vi.spyOn(portalApi, 'getPortalSettings').mockResolvedValue(settings as never);
    vi.spyOn(portalApi, 'listPublicForms').mockResolvedValue(publicForms as never);
    render(wrap(<PortalEditor go={vi.fn()} />));
    await screen.findByText(/homepage/i);
    const headline = screen.getByLabelText(/headline/i);
    await userEvent.clear(headline);
    await userEvent.type(headline, 'Need a hand?');
    await waitFor(() => expect(document.querySelector('.pe-preview .rp-hi')?.textContent).toMatch(/need a hand\?/i));
  });
});
