// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { BotProvider, useBot } from './bot';
import { Orb } from './agent';
import * as aiApi from '../api/ai';

function wrap(node: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{node}</QueryClientProvider>;
}

function Name() {
  return <span>{useBot().name}</span>;
}

describe('bot identity', () => {
  it('falls back to Tess without a provider (tests, previews)', () => {
    render(<Name />);
    expect(screen.getByText('Tess')).toBeInTheDocument();
  });

  it('serves the personalized name from /ai/identity through BotProvider', async () => {
    vi.spyOn(aiApi, 'getBotIdentity').mockResolvedValue({ name: 'Max', icon: '🤖' });
    render(wrap(<BotProvider><Name /></BotProvider>));
    await waitFor(() => expect(screen.getByText('Max')).toBeInTheDocument());
  });

  it('renders the custom icon inside the Orb, and none by default', async () => {
    vi.spyOn(aiApi, 'getBotIdentity').mockResolvedValue({ name: 'Max', icon: '🤖' });
    const { container, unmount } = render(wrap(<BotProvider><Orb size="md" /></BotProvider>));
    await waitFor(() => expect(container.querySelector('.orb-ic')?.textContent).toBe('🤖'));
    expect(container.querySelector('.orb')?.getAttribute('title')).toContain('Max');
    unmount();

    const plain = render(<Orb size="md" />);
    expect(plain.container.querySelector('.orb-ic')).toBeNull();
    expect(plain.container.querySelector('.orb')?.getAttribute('title')).toContain('Tess');
  });
});
