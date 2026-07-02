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

function wrap(node: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}><AuthProvider>{node}</AuthProvider></QueryClientProvider>;
}
beforeEach(() => vi.restoreAllMocks());
afterEach(() => vi.restoreAllMocks());

describe('Forms tab routing', () => {
  it('renders the forms list when an admin opens the Forms tab', async () => {
    vi.spyOn(authApi, 'me').mockResolvedValue({ id: '1', email: 'a@b.io', name: 'Ada', role: 'admin' });
    vi.spyOn(formsApi, 'listForms').mockResolvedValue([{ id: 'f1', name: 'Report an issue', categoryKey: 'IT', status: 'published', targetSchemaId: 's1', updatedAt: new Date().toISOString() } as never]);
    render(wrap(<Console user={{ id: '1', email: 'a@b.io', name: 'Ada', role: 'admin' }} />));
    await userEvent.click(screen.getByText('Forms'));
    await waitFor(() => expect(screen.getByText('Report an issue')).toBeInTheDocument());
  });
});
