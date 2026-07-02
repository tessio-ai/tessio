// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProseBody } from './ArticleProse';
import type { ArticleSection } from './kb-types';

const sections: ArticleSection[] = [
  {
    id: 'basics',
    heading: 'Start with the basics',
    blocks: [
      { t: 'p', html: 'A printer that reports <b>offline</b> usually still has power.' },
      { t: 'steps', items: ['Check the panel is lit.', 'Check the tray and toner.', 'Make sure you are on the network.'] },
      { t: 'list', items: ['Disconnect VPN if unneeded.', 'Restart your adapter.'] },
      { t: 'note', kind: 'tip', html: 'Tess clears stuck jobs after 30 minutes.' },
    ],
  },
  {
    id: 'escalate',
    heading: 'Still offline?',
    blocks: [{ t: 'p', html: 'Log a ticket with the asset tag.' }],
  },
];

describe('ProseBody', () => {
  it('renders section headings with anchored IDs', () => {
    render(<ProseBody sections={sections} />);
    const h2 = screen.getByRole('heading', { name: 'Start with the basics' });
    expect(h2.id).toBe('sec-basics');
    expect(screen.getByRole('heading', { name: 'Still offline?' }).id).toBe('sec-escalate');
  });

  it('renders paragraph blocks with HTML', () => {
    render(<ProseBody sections={sections} />);
    const matches = screen.getAllByText(/offline/);
    expect(matches.length).toBeGreaterThan(0);
    const para = matches.find((el) => el.tagName === 'P' || el.closest('p'));
    expect(para).toBeInTheDocument();
    const p = para?.tagName === 'P' ? para : para?.closest('p');
    expect(p?.querySelector('b')).toBeTruthy();
  });

  it('renders steps with numbered badges', () => {
    render(<ProseBody sections={sections} />);
    expect(screen.getByText('1')).toHaveClass('step-n');
    expect(screen.getByText('2')).toHaveClass('step-n');
    expect(screen.getByText('3')).toHaveClass('step-n');
    expect(screen.getByText(/Check the panel/)).toBeInTheDocument();
  });

  it('renders bullet lists with dots', () => {
    render(<ProseBody sections={sections} />);
    expect(screen.getByText(/Disconnect VPN/).closest('li')?.querySelector('.bullet-dot')).toBeTruthy();
  });

  it('renders callout notes with the correct class', () => {
    render(<ProseBody sections={sections} />);
    const callout = screen.getByText(/Tess clears/).closest('.callout');
    expect(callout).toHaveClass('tip');
  });
});
