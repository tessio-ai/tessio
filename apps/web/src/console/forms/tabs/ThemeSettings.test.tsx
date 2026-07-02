// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeTab } from './ThemeTab';
import { SettingsTab } from './SettingsTab';
import type { PortalTheme } from '@tessio/shared';

const theme: PortalTheme = { accent: '#4f46e5', layout: 'single', bg: 'plain', font: 'sans', showTess: true, headline: 'Report an issue', intro: '', success: '' };

describe('ThemeTab', () => {
  it('edits the headline via onChange', async () => {
    const onChange = vi.fn();
    render(<ThemeTab theme={theme} onChange={onChange} />);
    await userEvent.type(screen.getByLabelText(/headline/i), '!');
    expect(onChange).toHaveBeenCalled();
    expect((onChange.mock.calls.at(-1)![0] as PortalTheme).headline).toMatch(/!$/);
  });
});

describe('SettingsTab', () => {
  const form = { name: 'Report', key: 'report', categoryKey: 'IT', icon: 'alert' };
  it('edits name and triggers archive', async () => {
    const onChange = vi.fn();
    const onArchive = vi.fn();
    render(<SettingsTab values={form} categories={[{ key: 'IT', label: 'IT' }, { key: 'HR', label: 'HR' }]} onChange={onChange} onArchive={onArchive} />);
    await userEvent.type(screen.getByLabelText(/^name$/i), 'X');
    expect(onChange).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: /archive/i }));
    expect(onArchive).toHaveBeenCalled();
  });
});
