// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { FormsList } from './FormsList';
import * as formsApi from '../../api/forms';
import * as schemasApi from '../../api/schemas';

function wrap(node: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{node}</QueryClientProvider>;
}
beforeEach(() => vi.restoreAllMocks());
afterEach(() => vi.restoreAllMocks());

const form = { id: 'f1', name: 'Report an issue', categoryKey: 'IT', status: 'published', targetSchemaId: 's1', updatedAt: new Date().toISOString() };

describe('FormsList', () => {
  it('renders forms from the API', async () => {
    vi.spyOn(formsApi, 'listForms').mockResolvedValue([form as never]);
    render(wrap(<FormsList go={vi.fn()} />));
    await waitFor(() => expect(screen.getByText('Report an issue')).toBeInTheDocument());
  });

  it('shows an empty state when there are no forms', async () => {
    vi.spyOn(formsApi, 'listForms').mockResolvedValue([]);
    render(wrap(<FormsList go={vi.fn()} />));
    await waitFor(() => expect(screen.getByText(/no forms yet/i)).toBeInTheDocument());
  });

  it('New form creates a schema then a form and navigates to the editor', async () => {
    vi.spyOn(formsApi, 'listForms').mockResolvedValue([]);
    const createSchema = vi.spyOn(schemasApi, 'createSchema').mockResolvedValue({ id: 's-new' } as never);
    const createForm = vi.spyOn(formsApi, 'createForm').mockResolvedValue({ id: 'f-new' } as never);
    const go = vi.fn();
    render(wrap(<FormsList go={go} />));
    await waitFor(() => expect(screen.getByText(/no forms yet/i)).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /new form/i }));
    await waitFor(() => expect(createSchema).toHaveBeenCalled());
    expect(createForm).toHaveBeenCalled();
    await waitFor(() => expect(go).toHaveBeenCalledWith('forms', { formId: 'f-new' }));
  });

  it('surfaces an inline error when create fails', async () => {
    vi.spyOn(formsApi, 'listForms').mockResolvedValue([]);
    vi.spyOn(schemasApi, 'createSchema').mockResolvedValue({ id: 's-new' } as never);
    vi.spyOn(formsApi, 'createForm').mockRejectedValue(Object.assign(new Error('x'), { status: 409, detail: 'A form with key "x" already exists' }));
    const go = vi.fn();
    render(wrap(<FormsList go={go} />));
    await waitFor(() => expect(screen.getByText(/no forms yet/i)).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /new form/i }));
    await waitFor(() => expect(screen.getByText(/already exists/i)).toBeInTheDocument());
    expect(go).not.toHaveBeenCalled();
  });
});
