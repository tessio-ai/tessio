// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginPage } from './LoginPage';
import { getLoginBranding } from '../api/login-settings';

vi.mock('../api/sso', () => ({
  getSsoInfo: vi.fn().mockRejectedValue(new Error('sso unavailable')),
}));
vi.mock('../api/login-settings', () => ({
  getLoginBranding: vi.fn().mockRejectedValue(new Error('branding unavailable')),
}));

describe('LoginPage', () => {
  beforeEach(() => {
    vi.mocked(getLoginBranding).mockRejectedValue(new Error('branding unavailable'));
  });

  it('submits email + password', async () => {
    const onLogin = vi.fn().mockResolvedValue(undefined);
    render(<LoginPage onLogin={onLogin} />);
    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.io');
    await userEvent.type(screen.getByLabelText(/^password$/i), 'secret');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(onLogin).toHaveBeenCalledWith('a@b.io', 'secret');
  });

  it('shows an error when login fails', async () => {
    const onLogin = vi.fn().mockRejectedValue(new Error('Invalid email or password'));
    render(<LoginPage onLogin={onLogin} />);
    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.io');
    await userEvent.type(screen.getByLabelText(/^password$/i), 'bad');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument());
  });

  it('toggles password visibility', async () => {
    render(<LoginPage onLogin={vi.fn()} />);
    const password = screen.getByLabelText(/^password$/i);
    expect(password).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByRole('button', { name: /show password/i }));
    expect(password).toHaveAttribute('type', 'text');
    await userEvent.click(screen.getByRole('button', { name: /hide password/i }));
    expect(password).toHaveAttribute('type', 'password');
  });

  it('falls back to stock branding when the branding fetch fails', async () => {
    render(<LoginPage onLogin={vi.fn()} />);
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(screen.getByText('Tessio')).toBeInTheDocument();
  });

  it('renders workspace branding (name, copy, and logo)', async () => {
    vi.mocked(getLoginBranding).mockResolvedValue({
      brandName: 'Ebolt',
      logo: 'data:image/png;base64,iVBORw0KGgo=',
      headline: 'Sign in with email',
      tagline: 'Bring your words, data, and teams together.',
      accent: '#0d9488',
    });
    const { container } = render(<LoginPage onLogin={vi.fn()} />);
    expect(await screen.findByRole('heading', { name: 'Sign in with email' })).toBeInTheDocument();
    expect(screen.getByText('Ebolt')).toBeInTheDocument();
    expect(screen.getByText(/bring your words/i)).toBeInTheDocument();
    await waitFor(() => {
      const logos = container.querySelectorAll('img[src^="data:image/png"]');
      expect(logos.length).toBe(2); // topbar mark + card badge
    });
  });
});
