// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PortalCatalogView } from './PortalCatalogView';
import type { PortalCatalogConfig } from '@tessio/shared';

const cfg: PortalCatalogConfig = { sectionStyle: 'band', cardStyle: 'comfortable', columns: 'auto' };
const groups = [{ category: { key: 'IT', label: 'IT', icon: 'laptop', color: '#2563eb', order: 0, visible: true },
  items: [{ key: 'a', name: 'Reset password', description: 'fast', categoryKey: 'IT', icon: 'lock', theme: { showTess: true } }] }] as never;

describe('PortalCatalogView', () => {
  it('renders category groups and opens a form via a button', async () => {
    const onOpen = vi.fn();
    render(<PortalCatalogView catalog={cfg} groups={groups} orphans={[]} onOpenForm={onOpen} />);
    expect(screen.getByText('IT')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /reset password/i }));
    expect(onOpen).toHaveBeenCalledWith('a');
  });
  it('renders orphans under "Other requests"', () => {
    const orphan = [{ key: 'z', name: 'VPN', description: null, categoryKey: 'X', icon: null, theme: { showTess: false } }] as never;
    render(<PortalCatalogView catalog={cfg} groups={[]} orphans={orphan} onOpenForm={vi.fn()} />);
    expect(screen.getByText(/other requests/i)).toBeInTheDocument();
    expect(screen.getByText('VPN')).toBeInTheDocument();
  });
  it('applies the section + card data attributes', () => {
    render(<PortalCatalogView catalog={{ sectionStyle: 'plain', cardStyle: 'compact', columns: 3 }} groups={groups} orphans={[]} onOpenForm={() => {}} />);
    const root = document.querySelector('.rp-catalog')!;
    expect(root.getAttribute('data-section-style')).toBe('plain');
    expect(root.getAttribute('data-card-style')).toBe('compact');
    expect((root as HTMLElement).style.getPropertyValue('--cols')).toBe('3');
    expect(document.querySelector('.rp-cat-head.band')).toBeNull();
  });
  it('renders compact rows when cardStyle is compact', () => {
    render(<PortalCatalogView catalog={{ sectionStyle: 'band', cardStyle: 'compact', columns: 2 }} groups={groups} orphans={[]} onOpenForm={() => {}} />);
    expect(document.querySelector('.rp-row')).not.toBeNull();
    expect(document.querySelector('.rp-card')).toBeNull();
  });
});
