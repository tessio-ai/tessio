// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tldr, Feedback } from './KbShared';

describe('Tldr', () => {
  it('renders bullet points with gradient dots', () => {
    render(<Tldr points={['Point <b>one</b>.', 'Point two.']} />);
    expect(screen.getByText('Tess summary')).toBeInTheDocument();
    expect(screen.getAllByText(/Point/).length).toBeGreaterThan(0);
    const items = document.querySelectorAll('.tldr li');
    expect(items).toHaveLength(2);
  });
});

describe('Feedback', () => {
  it('shows question initially, then thanks after voting', async () => {
    render(<Feedback />);
    expect(screen.getByText('Was this article helpful?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Yes/ }));
    expect(screen.getByText(/Glad it helped/)).toBeInTheDocument();
    expect(screen.getByText('Feedback recorded')).toBeInTheDocument();
  });

  it('shows different message for "No" vote', async () => {
    render(<Feedback />);
    await userEvent.click(screen.getByRole('button', { name: /No/ }));
    expect(screen.getByText(/improve this article/)).toBeInTheDocument();
  });
});
