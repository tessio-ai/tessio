// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PortalHero } from './PortalHero';
import type { PortalSettingsRow } from '../../api/portal';

const base: PortalSettingsRow = {
  orgId: 'o', brandName: 'Acme', logo: 'A', heroHeadline: 'How can we *help*?', heroIntro: 'Ask',
  accent: '#4f46e5', showTess: true, categories: [], updatedAt: '',
  hero: { preset: 'spotlight', eyebrow: 'Acme Help', pills: [], showSearch: true },
  catalog: { sectionStyle: 'band', cardStyle: 'comfortable', columns: 'auto' },
};
const forms = [{ key: 'a', name: 'Reset password', description: null, categoryKey: 'IT', icon: null, theme: { showTess: true } }] as never;

describe('PortalHero', () => {
  it('renders the preset class, an h1 with the emphasised word, eyebrow, and pills', () => {
    render(<PortalHero settings={base} forms={forms} onOpenForm={vi.fn()} />);
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent('How can we help?');
    expect(h1.querySelector('.hl-em')?.textContent).toBe('help');
    expect(screen.getByText('Acme Help')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset password' })).toBeInTheDocument();
    expect(document.querySelector('.rp-hero')?.getAttribute('data-preset')).toBe('spotlight');
  });
  it('hides the search field when showSearch is false', () => {
    render(<PortalHero settings={{ ...base, hero: { ...base.hero, showSearch: false } }} forms={forms} onOpenForm={vi.fn()} />);
    expect(screen.queryByPlaceholderText(/search/i)).not.toBeInTheDocument();
  });
  it('opens a form when a pill is clicked', async () => {
    const onOpen = vi.fn();
    render(<PortalHero settings={base} forms={forms} onOpenForm={onOpen} />);
    await userEvent.click(screen.getByRole('button', { name: 'Reset password' }));
    expect(onOpen).toHaveBeenCalledWith('a');
  });
  it('renders the editorial and aurora presets via data-preset', () => {
    const { rerender } = render(<PortalHero settings={{ ...base, hero: { ...base.hero, preset: 'editorial' } }} forms={forms} onOpenForm={() => {}} />);
    expect(document.querySelector('.rp-hero')?.getAttribute('data-preset')).toBe('editorial');
    rerender(<PortalHero settings={{ ...base, hero: { ...base.hero, preset: 'aurora' } }} forms={forms} onOpenForm={() => {}} />);
    expect(document.querySelector('.rp-hero')?.getAttribute('data-preset')).toBe('aurora');
  });
});
