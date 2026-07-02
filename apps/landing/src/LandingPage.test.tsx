// SPDX-License-Identifier: AGPL-3.0-only

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { LandingPage } from './LandingPage';

const BANNED = [
  /try for free/i,
  /book a demo/i,
  /contact sales/i,
  /pricing/i,
  /\btrial\b/i,
  /credit card/i,
  /\blog in\b/i,
  /open the app/i,
  /\bcloud\b/i,
  /open[ -]source/i, // proprietary (Elastic License 2.0), not OSI open-source
];

describe('LandingPage (community)', () => {
  it('renders the hero headline', () => {
    render(<LandingPage />);
    expect(screen.getByText(/autopilot/i)).toBeInTheDocument();
  });

  it('points the primary CTA at GitHub', () => {
    render(<LandingPage />);
    const gh = screen.getAllByRole('link', { name: /view on github/i });
    expect(gh.length).toBeGreaterThan(0);
  });

  it('contains no cloud / SaaS framing', () => {
    const { container } = render(<LandingPage />);
    const text = container.textContent ?? '';
    for (const pattern of BANNED) {
      expect(text, `found banned phrase ${pattern}`).not.toMatch(pattern);
    }
  });

  it('renders the product showcase window with the Tess assist panel', () => {
    const { container } = render(<LandingPage />);
    expect(container.querySelector('.landing-showcase .appwin')).toBeInTheDocument();
    expect(container.querySelector('.aw-assist-card')).toBeInTheDocument();
  });

  it('renders the four alternating feature rows', () => {
    const { container } = render(<LandingPage />);
    expect(container.querySelectorAll('.landing-frows .frow')).toHaveLength(4);
    // dashboard count-up numerals carry their target value as data-to
    expect(container.querySelectorAll('.d2-n[data-to]').length).toBeGreaterThan(0);
  });
});
